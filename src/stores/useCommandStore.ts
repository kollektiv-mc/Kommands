import { create } from 'zustand'
import type { CommandValue } from '../schema/serialize'
import { EMPTY_VALUE } from '../schema/serialize'
import {
  clearSubtree,
  instance,
  repeatInstances,
  type InstanceId,
  type Path,
} from '../schema/paths'
import { nextInstanceIdFor } from '../schema/saved'
import {
  emptyHistory,
  record,
  redo as historyRedo,
  undo as historyUndo,
  type HistoryState,
} from './commandHistory'

/**
 * The value tree for the command currently being edited.
 *
 * One store, not one per command: the tree is keyed by path, and paths are relative
 * to whichever definition is loaded. Switching commands resets it, because a path
 * means nothing outside the definition it was built against.
 */
interface CommandState {
  value: CommandValue
  /**
   * The next instance id to hand out.
   *
   * In the store rather than a module counter so it resets with the tree, which is what
   * makes ids deterministic in a test without any global to reach into. Ids need only be
   * unique within one value tree, so a counter is enough — and unlike a random id it
   * makes a failing assertion readable.
   */
  nextInstanceId: number
  /**
   * The undo and redo stacks for this tree.
   *
   * Exposed as state rather than hidden behind `canUndo()`/`canRedo()` actions so a
   * control can subscribe to it and re-render when a step becomes available. The
   * predicates live in `commandHistory.ts` and read this.
   */
  history: HistoryState
  /**
   * Step the tree back to the snapshot before the last change, or forward again.
   *
   * `nextInstanceId` is deliberately **not** stepped with it. Ids only have to be
   * unique within one tree, and rewinding the counter would hand a fresh clause an id
   * that an undone one already used - which is two instances on one path, the exact
   * failure the generated-id model exists to prevent, arriving by a route nothing
   * checks. Burning an id on an undone clause costs nothing.
   */
  undo: () => void
  redo: () => void
  setArg: (path: Path, value: unknown) => void
  setFlag: (path: Path, on: boolean) => void
  setChoice: (path: Path, index: number) => void
  /**
   * Add one instance to a Repeat, unless it is already at `max`.
   *
   * Replaces a general `setRepeat(path, count)`, whose only caller passed `count + 1`.
   * A narrower action is also the one place a limit can live: `RepeatNode.max` was
   * declared, documented in `command-schema.md`, and read by nothing, so a Repeat
   * declared `max: 3` accepted a fourth (part of #30).
   */
  addInstance: (path: Path, node: { min?: number; max?: number }) => void
  /**
   * Put a Repeat's instances into `ids`.
   *
   * One action covers moving and removing, because to a path-keyed tree they are the
   * same operation: a new ordering, with removal the case where one id is left out.
   *
   * What is *not* the same as before: reordering no longer touches a single value key.
   * The ids are the identity, so permuting the list moves the clauses and every value
   * beneath them comes along by staying exactly where it is. Removal still has to clear
   * the dropped instance's subtree — the alternative, leaving the keys in place, is what
   * made a removed clause's values reappear in the next one added.
   */
  reorderRepeat: (path: Path, ids: readonly InstanceId[], tag?: string) => void
  /**
   * Point a `@any` Ref at a command, discarding whatever the last one held.
   *
   * The embedded command's values are keyed below this Ref's path, and those paths
   * mean nothing to a different command — `/give`'s item sits exactly where
   * `/particle` reads a position. Keeping them does not produce a wrong command; it
   * hands a serializer a value of a shape its own type never makes.
   */
  setRef: (path: Path, definitionId: string) => void
  /**
   * Replace the whole tree with a saved one, and resume its id counter.
   *
   * The counter is the reason this is an action rather than a `set` at the call site.
   * Instance ids are handed out as `i0`, `i1`, … from `nextInstanceId`, which resets
   * with the tree — so loading a tree that already holds `i0` and `i1` while leaving
   * the counter at zero makes the next added clause `i0` as well. Two instances on one
   * path is exactly the failure the generated-id model exists to prevent, and it would
   * surface as one clause's edits appearing in another.
   */
  load: (value: CommandValue) => void
  reset: () => void
}

/** Every table in the value tree, cleared at and below one path. */
function clearAt(value: CommandValue, path: Path): CommandValue {
  return {
    args: clearSubtree(value.args, path),
    flags: clearSubtree(value.flags, path),
    choices: clearSubtree(value.choices, path),
    repeats: clearSubtree(value.repeats, path),
    refs: clearSubtree(value.refs, path),
  }
}

export const useCommandStore = create<CommandState>((set) => ({
  value: EMPTY_VALUE,
  nextInstanceId: 0,
  history: emptyHistory(),
  undo: () =>
    set((s) => {
      const stepped = historyUndo(s.history, s.value)
      if (stepped === null) return s
      return { history: stepped.state, value: stepped.snapshot }
    }),
  redo: () =>
    set((s) => {
      const stepped = historyRedo(s.history, s.value)
      if (stepped === null) return s
      return { history: stepped.state, value: stepped.snapshot }
    }),
  setArg: (path, value) =>
    set((s) => ({
      // Tagged by path, so a burst of keystrokes in one field is one undo step. Moving
      // to another field changes the tag and starts a new one.
      history: record(s.history, s.value, `arg:${path}`),
      value: { ...s.value, args: { ...s.value.args, [path]: value } },
    })),
  setFlag: (path, on) =>
    set((s) => ({
      // Untagged, here and below. Everything but typing into a field is discrete: one
      // click, one step, and it ends whatever burst was in progress.
      history: record(s.history, s.value),
      value: { ...s.value, flags: { ...s.value.flags, [path]: on } },
    })),
  setChoice: (path, index) =>
    set((s) => ({
      history: record(s.history, s.value),
      value: { ...s.value, choices: { ...s.value.choices, [path]: index } },
    })),
  addInstance: (path, node) =>
    set((s) => {
      const current = repeatInstances(s.value.repeats, path, node)
      // Warns nowhere and blocks here, which is the right way round: `max` is a fact
      // about the command's grammar rather than about the value someone typed, so the
      // control that would exceed it is not offered in the first place.
      //
      // Returning before `record` matters as much as returning at all: a refused add
      // that still pushed a snapshot would leave an undo step that changes nothing,
      // and a user pressing undo would watch it do nothing once per refusal.
      if (node.max !== undefined && current.length >= node.max) return s
      return {
        history: record(s.history, s.value),
        nextInstanceId: s.nextInstanceId + 1,
        value: {
          ...s.value,
          repeats: { ...s.value.repeats, [path]: [...current, `i${s.nextInstanceId}`] },
        },
      }
    }),
  reorderRepeat: (path, ids, tag) =>
    set((s) => {
      const dropped = (s.value.repeats[path] ?? []).filter((id) => !ids.includes(id))
      // Only the dropped instances are touched. Everything that survives keeps its keys,
      // which is the property the ids exist to buy.
      const cleared = dropped.reduce((acc, id) => clearAt(acc, instance(path, id)), s.value)
      return {
        // The snapshot is taken before the subtree is cleared, so undoing a removed
        // clause brings its values back with it rather than restoring an empty one.
        //
        // `tag` is what makes a *drag* one undo step. A pointer crossing three card
        // midpoints reorders three times, and without a tag naming the gesture each
        // one would be its own step - so undoing a drag would walk back through the
        // positions it passed through instead of returning to where it started. The
        // caller mints it per gesture; a click on a move control passes none, because
        // one click genuinely is one step.
        history: record(s.history, s.value, tag ?? null),
        value: { ...cleared, repeats: { ...cleared.repeats, [path]: [...ids] } },
      }
    }),
  setRef: (path, definitionId) =>
    set((s) => {
      // Re-picking the same command keeps everything filled in. Only a genuine change
      // clears, so brushing the picker does not cost the user their work - and, as in
      // `addInstance`, a no-op must not leave an undo step behind either.
      if (s.value.refs[path] === definitionId) return s
      const cleared = clearAt(s.value, path)
      return {
        history: record(s.history, s.value),
        value: { ...cleared, refs: { ...cleared.refs, [path]: definitionId } },
      }
    }),
  // Both replace the tree wholesale, so the history goes with it. A step back into the
  // previous command's tree would be a step into paths this definition does not have.
  load: (value) =>
    set({ value, nextInstanceId: nextInstanceIdFor(value), history: emptyHistory() }),
  reset: () => set({ value: EMPTY_VALUE, nextInstanceId: 0, history: emptyHistory() }),
}))
