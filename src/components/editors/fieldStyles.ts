/**
 * The one place a field's classes are written down.
 *
 * Editors are small and numerous, so a shared string is the difference between one
 * place to change the field look and fifteen. Semantic utilities only — these paths
 * are covered by the `no literal hex or px in components` invariant.
 */
export const FIELD =
  'border-hairline border-border-hover bg-canvas text-text-primary placeholder:text-text-faint ' +
  'min-h-8 rounded-md px-2.5 py-1.5 font-mono text-xs outline-none ' +
  'hover:border-text-faint focus:border-accent aria-invalid:border-warning ' +
  'transition-colors duration-fast ease-standard motion-reduce:transition-none'

/** A caption: a count, a section name. Small and quiet, and used across the app. */
export const LABEL = 'text-text-secondary text-2xs'

/**
 * A caption inside an editor: `amount` beside a modifier's amount, `click` before a
 * click event. Smaller than an argument's name and quieter, but never below 11px,
 * which is as small as anything in the command form gets.
 */
export const SUB_LABEL = 'text-text-secondary text-1xs'

/** An argument's name in the form. Read first in every row, so it is the primary text. */
export const ARG_LABEL = 'text-text-primary text-xs font-medium'

/**
 * What an argument is for. `text-secondary` rather than muted: help is read, and the
 * muted step sits near 3:1 on a panel, which is for marks rather than sentences.
 */
export const HELP = 'text-text-secondary text-1xs leading-snug'

export const WARNING = 'text-warning text-1xs leading-snug'

/**
 * The focus ring for anything that is not a text field (a text field shows focus with
 * its border). An outline rather than Tailwind's `ring`, which is a box-shadow, and the
 * design language has none.
 */
export const FOCUS =
  'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent'
