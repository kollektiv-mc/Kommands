import { Color, SRGBColorSpace } from 'three'

/**
 * The token layer's colours, as Three.js understands them.
 *
 * Not as direct as it looks, and the indirection is load-bearing twice over.
 *
 * **Why a channel triplet rather than the colour itself.** `docs/design-tokens.md`
 * stores status colours as `--accent-rgb: 74 222 128` so alpha composes from one token.
 * The derived `--accent` is therefore `rgb(74 222 128)` — modern space-separated CSS —
 * and `new Color('rgb(74 222 128)')` returns **white**: Three's `setStyle` only matches
 * the comma-separated form, and it fails by falling back rather than by throwing. A
 * preview drawn in silently-wrong white is exactly the failure this repo's invariants
 * exist to catch, and no grep can see it, so it is pinned by a test instead.
 *
 * **Why the colour space is explicit.** `setRGB` interprets its arguments in Three's
 * *working* space, which is linear-sRGB. Handing it sRGB channels without saying so
 * yields a visible, plausible, wrong green rather than the accent. `color.test.ts` holds
 * both wrong answers as literals, which is where a literal colour belongs.
 */

/** `"74 222 128"` — the shape `--accent-rgb` and its siblings hold. */
export function colorFromChannels(triplet: string): Color | undefined {
  const parts = triplet
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
  if (parts.length !== 3) return undefined

  const channels = parts.map(Number)
  if (channels.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return undefined

  const [r, g, b] = channels as [number, number, number]
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
}

/**
 * Read a channel-triplet token off the document.
 *
 * A material needs a *value* rather than a class, so the custom property is resolved
 * rather than referenced — which keeps `.claude/rules/styling.md` satisfied in substance
 * as well as in letter, and means a theme change moves the preview with everything else.
 */
export function tokenColor(name: string): Color | undefined {
  if (typeof document === 'undefined') return undefined
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
  return raw === '' ? undefined : colorFromChannels(raw)
}
