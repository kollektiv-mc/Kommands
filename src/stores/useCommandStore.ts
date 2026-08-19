import { create } from 'zustand'
import type { CommandValue } from '../schema/serialize'
import { EMPTY_VALUE } from '../schema/serialize'
import type { Path } from '../schema/paths'

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
  setRef: (path, definitionId) =>
    set((s) => ({ value: { ...s.value, refs: { ...s.value.refs, [path]: definitionId } } })),
  reset: () => set({ value: EMPTY_VALUE }),
}))
