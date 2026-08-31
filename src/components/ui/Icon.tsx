import { PATHS, type IconName } from '../../lib/icons'

/**
 * Rendered stroke weight, in real screen pixels.
 *
 * A screen value rather than one of lucide's own viewBox numbers, which scale with the
 * box: lucide's native 2 on its 24-unit grid draws 1.33px at 16px and 1.17px at 14px,
 * so one number there is a different weight at every size in this UI. Dividing by the
 * box below is what holds it to one screen value — landing between the two border
 * tokens the design language is built from (0.5px hairline, 1.5px thick) at every
 * size rather than only at one. Konnekt reaches the same value through lucide's
 * `absoluteStrokeWidth`; the arithmetic here is what that flag does.
 *
 * Not a design token: `tokens.source.json` is vendored from kollektiv and shared with
 * Konnekt, so an icon value added there is reverted by the next sync. Konnekt's own
 * `Icon.tsx` says the same thing about the same number.
 */
const STROKE_PX = 1.25

/**
 * Sizes come from Tailwind's spacing scale, which `tokens.css` deliberately does not
 * redeclare — its own comment says Tailwind's `--spacing` already matches the shared
 * scale. So `size-3.5` is 14px from the same source the padding utilities read, not an
 * arbitrary literal, and the `no literal hex or px in components` grep stays silent.
 *
 * Both halves of an entry reach the SVG and cannot drift, because they are one entry:
 * the class paints the box, and the number is what the stroke is computed against.
 */
const SIZE = {
  sm: { cls: 'size-3.5', px: 14 },
  md: { cls: 'size-4', px: 16 },
} as const

/**
 * The single render path for every icon in the app.
 *
 * One `<path>` for the whole glyph, with the subpaths separated by `M` commands in
 * `lib/icons.tsx`. Lucide splits them across several elements; merging them is
 * equivalent under `fill: none` and saves an element per icon.
 */
export function Icon({
  name,
  size = 'md',
  className = '',
}: {
  name: IconName
  size?: keyof typeof SIZE
  /**
   * Colour and opacity only. Never a `size-*`: two same-specificity rules resolve by
   * stylesheet order rather than by string order, which would leave the painted box
   * disagreeing with the size the stroke was computed against.
   */
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      // Held to a screen weight rather than a viewBox one — see STROKE_PX.
      strokeWidth={(STROKE_PX * 24) / SIZE[size].px}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default: an icon inside a labelled button carries no meaning of
      // its own, and announcing it would name the control twice.
      aria-hidden="true"
      className={`${SIZE[size].cls} shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
