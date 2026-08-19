/**
 * The one place a field's classes are written down.
 *
 * Editors are small and numerous, so a shared string is the difference between one
 * place to change the field look and fifteen. Semantic utilities only — these paths
 * are covered by the `no literal hex or px in components` invariant.
 */
export const FIELD =
  'border-hairline border-border-subtle bg-canvas text-text-primary rounded-md px-2 py-1 ' +
  'font-mono text-1xs outline-none focus:border-border-hover'

export const LABEL = 'text-text-secondary text-2xs'

export const WARNING = 'text-warning text-2xs'
