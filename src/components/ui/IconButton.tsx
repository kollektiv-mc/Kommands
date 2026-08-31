import type { ReactNode } from 'react'

/**
 * The tones an icon control comes in. `danger` is for the one irreversible thing in a
 * bar — closing the window — and nothing else.
 */
const TONES = {
  muted: 'text-text-faint hover:text-text-primary hover:bg-hover',
  danger: 'text-text-faint hover:text-danger hover:bg-danger/10',
} as const

/**
 * One square, flex-centred box for an icon control.
 *
 * The box is the point, and it is Konnekt's `ui/IconButton` verbatim in intent: these
 * sit in rows — a title bar, a panel header — and a control that sizes itself from its
 * own glyph leaves no two of them sharing a width, a height, or a distance from the
 * edge. `h-6 w-6` around a 14–16px glyph leaves a ring of hit area, so the hover
 * background reads as a target rather than tracing the ink.
 *
 * Where this belongs: a control that closes, expands or restores a panel, dialog or
 * window. Not the small `×` that clears a field or drops one chip from a row — those
 * live inside dense rows at their own scale, and a 24px box would set the height of
 * the row around them.
 */
export function IconButton({
  onClick,
  title,
  children,
  tone = 'muted',
  className = '',
  disabled,
  'aria-pressed': pressed,
}: {
  onClick?: () => void
  /** Both the tooltip and the accessible name — the icon carries neither. */
  title: string
  children: ReactNode
  tone?: keyof typeof TONES
  className?: string
  disabled?: boolean
  'aria-pressed'?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  )
}
