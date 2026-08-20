import { create } from 'zustand'
import type { CommandValue } from '../schema/serialize'
import { EMPTY_VALUE } from '../schema/serialize'
import { clearSubtree, reindexInstances, type Path } from '../schema/paths'

/**
 * The value tree for the command currently being edited.
 *
 * One store, not one per command: the tree is keyed by path, and paths are relative
 * to whichever definition is loaded. Switching commands resets it, because a path
 * means nothing outside the definition it was built against.
 */
interface CommandState {
  value: CommandValue
  setArg: (path: Path, value: unknown) => void
  setFlag: (path: Path, on: boolean) => void
  setChoice: (path: Path, index: number) => void
  setRepeat: (path: Path, count: number) => void
  /**
   * Put a Repeat's instances into `order`, where `order[i]` is the index now at `i`.
   *
   * One action covers moving and removing, because to a path-keyed tree they are the
   * same operation: a permutation of the indices, with removal the case where one is
   * left out. Doing it any other way leaves values stranded under an index no longer
   * rendered, which is not merely untidy — they come back when the next clause is
   * added, in a clause the user did not fill in.
   */
  reorderRepeat: (path: Path, order: readonly number[]) => void
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

export const useCommandStore = create<CommandState>((set) => ({
  value: EMPTY_VALUE,
  setArg: (path, value) =>
    set((s) => ({ value: { ...s.value, args: { ...s.value.args, [path]: value } } })),
  setFlag: (path, on) =>
    set((s) => ({ value: { ...s.value, flags: { ...s.value.flags, [path]: on } } })),
  setChoice: (path, index) =>
    set((s) => ({ value: { ...s.value, choices: { ...s.value.choices, [path]: index } } })),
  setRepeat: (path, count) =>
    set((s) => ({
      value: { ...s.value, repeats: { ...s.value.repeats, [path]: Math.max(0, count) } },
    })),
  reorderRepeat: (path, order) =>
    set((s) => ({
      value: {
        args: reindexInstances(s.value.args, path, order),
        flags: reindexInstances(s.value.flags, path, order),
        choices: reindexInstances(s.value.choices, path, order),
        // The Repeat's own count keys on `path`, not on `path/#n`, so it survives the
        // remap untouched and is set here. Nested repeats below it do move.
        repeats: { ...reindexInstances(s.value.repeats, path, order), [path]: order.length },
        refs: reindexInstances(s.value.refs, path, order),
      },
    })),
  setRef: (path, definitionId) =>
    set((s) => {
      // Re-picking the same command keeps everything filled in. Only a genuine change
      // clears, so brushing the picker does not cost the user their work.
      if (s.value.refs[path] === definitionId) return s
      return {
        value: {
          args: clearSubtree(s.value.args, path),
          flags: clearSubtree(s.value.flags, path),
          choices: clearSubtree(s.value.choices, path),
          repeats: clearSubtree(s.value.repeats, path),
          refs: { ...clearSubtree(s.value.refs, path), [path]: definitionId },
        },
      }
    }),
  reset: () => set({ value: EMPTY_VALUE }),
}))
