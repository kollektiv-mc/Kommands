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
  reorderRepeat: (path: Path, ids: readonly InstanceId[]) => void
  /**
   * Point a `@any` Ref at a command, discarding whatever the last one held.
   *
   * The embedded command's values are keyed below this Ref's path, and those paths
   * mean nothing to a different command — `/give`'s item sits exactly where
   * `/particle` reads a position. Keeping them does not produce a wrong command; it
   * hands a serializer a value of a shape its own type never makes.
   */
  setRef: (path: Path, definitionId: string) => void
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
  setArg: (path, value) =>
    set((s) => ({ value: { ...s.value, args: { ...s.value.args, [path]: value } } })),
  setFlag: (path, on) =>
    set((s) => ({ value: { ...s.value, flags: { ...s.value.flags, [path]: on } } })),
  setChoice: (path, index) =>
    set((s) => ({ value: { ...s.value, choices: { ...s.value.choices, [path]: index } } })),
  addInstance: (path, node) =>
    set((s) => {
      const current = repeatInstances(s.value.repeats, path, node)
      // Warns nowhere and blocks here, which is the right way round: `max` is a fact
      // about the command's grammar rather than about the value someone typed, so the
      // control that would exceed it is not offered in the first place.
      if (node.max !== undefined && current.length >= node.max) return s
      return {
        nextInstanceId: s.nextInstanceId + 1,
        value: {
          ...s.value,
          repeats: { ...s.value.repeats, [path]: [...current, `i${s.nextInstanceId}`] },
        },
      }
    }),
  reorderRepeat: (path, ids) =>
    set((s) => {
      const dropped = (s.value.repeats[path] ?? []).filter((id) => !ids.includes(id))
      // Only the dropped instances are touched. Everything that survives keeps its keys,
      // which is the property the ids exist to buy.
      const cleared = dropped.reduce((acc, id) => clearAt(acc, instance(path, id)), s.value)
      return { value: { ...cleared, repeats: { ...cleared.repeats, [path]: [...ids] } } }
    }),
  setRef: (path, definitionId) =>
    set((s) => {
      // Re-picking the same command keeps everything filled in. Only a genuine change
      // clears, so brushing the picker does not cost the user their work.
      if (s.value.refs[path] === definitionId) return s
      const cleared = clearAt(s.value, path)
      return { value: { ...cleared, refs: { ...cleared.refs, [path]: definitionId } } }
    }),
  reset: () => set({ value: EMPTY_VALUE, nextInstanceId: 0 }),
}))
