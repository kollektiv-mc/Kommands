import { create } from 'zustand'
import type { Path } from '../schema/paths'

/**
 * Which form row the pointer is on, or which piece of the output, so the other lights up.
 *
 * A store rather than state in the workbench, because the workbench would re-render the
 * whole form on every pointer move. Each row and each piece subscribes to one boolean
 * (`field === mine`), so a move re-renders the two things whose answer changed.
 */
interface OutputHover {
  field: Path | null
  hover: (field: Path | null) => void
}

export const useOutputHover = create<OutputHover>((set) => ({
  field: null,
  hover: (field) => set({ field }),
}))

/** Whether `field` is the one lit. Absent never is. */
export const useLit = (field: Path | undefined): boolean =>
  useOutputHover((s) => field !== undefined && s.field === field)
