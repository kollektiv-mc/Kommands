/**
 * Classes for the repeating rows the deep editors are built from.
 *
 * The same reason fieldStyles.ts exists: four editors lay out add/remove rows the
 * same way, and a shared string is the difference between one place to change that
 * and four. Semantic utilities only — these paths are covered by the
 * `no literal hex or px in components` invariant.
 */
export const ROW = 'flex flex-wrap items-end gap-2'

export const ROW_ADD =
  'text-accent hover:bg-accent/10 self-start rounded-md px-1.5 py-0.5 text-xs font-medium ' +
  'transition-colors duration-fast motion-reduce:transition-none'

export const ROW_REMOVE =
  'text-text-muted hover:text-danger rounded-md px-1.5 py-0.5 text-xs ' +
  'transition-colors duration-fast motion-reduce:transition-none'

/** A removable block of fields, set off from the ones around it by a hairline. */
export const ROW_GROUP = 'border-l-hairline border-border-subtle flex flex-col gap-2 pl-2'
