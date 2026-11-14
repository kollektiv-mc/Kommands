/**
 * The shape editor's class strings, written down once.
 *
 * Semantic utilities over the token layer only, like `editors/fieldStyles.ts`: these
 * paths are covered by the `no literal hex or px in components` invariant.
 */

/** One of the three tiles, and the command bar. */
export const PANEL =
  'border-hairline border-border-subtle bg-surface rounded-panel flex min-h-0 flex-col overflow-hidden'

export const PANEL_HEAD =
  'border-b-hairline border-border-subtle flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-semibold'

/** A section's name: small capitals, quiet. */
export const EYEBROW = 'text-text-muted text-3xs font-bold tracking-widest uppercase'

/** A bordered button in a toolbar or an action row. */
export const BUTTON =
  'border-hairline border-border-hover bg-surface text-text-secondary hover:text-text-primary hover:border-text-faint ' +
  'inline-flex h-7.5 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap ' +
  'disabled:cursor-default disabled:opacity-40'

export const PRIMARY =
  'bg-accent text-canvas inline-flex h-7.5 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold ' +
  'whitespace-nowrap hover:brightness-110'

/** A strip of mutually exclusive buttons, pressed one drawn raised. */
export const SEG =
  'border-hairline border-border-hover bg-overlay inline-flex gap-0.5 rounded-md p-0.5'
export const SEG_BUTTON =
  'text-text-secondary hover:text-text-primary aria-pressed:bg-hover aria-pressed:text-text-primary ' +
  'inline-flex h-6.5 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold'

/** A number or text field in the inspector. */
export const NUM =
  'border-hairline border-border-subtle bg-canvas focus-within:border-accent flex h-7 min-w-0 items-center rounded-md'

/** The colour each op is drawn in: Add the accent, Cut danger, Overlap warning. */
export const OP_TONE = {
  add: 'bg-accent/15 text-accent',
  cut: 'bg-danger/15 text-danger',
  overlap: 'bg-warning/15 text-warning',
} as const

export const OP_GLYPH = { add: '+', cut: '−', overlap: '∩' } as const
export const OP_LABEL = { add: 'Add', cut: 'Cut', overlap: 'Overlap' } as const
