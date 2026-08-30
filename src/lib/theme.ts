/**
 * Kommands' product accent, applied at runtime.
 *
 * The suite's two products share one token source and differ by accent: Konnekt is
 * green, Kommands is ember orange. That difference cannot live in
 * `tokens.source.json` — it is vendored from `kollektiv/design/tokens.json` and read
 * by *both* products, so an orange written there would turn Konnekt orange too, and
 * the next `sync-tokens.sh` would overwrite it regardless (CLAUDE.md § Conventions,
 * rule 4).
 *
 * The token source anticipates this: `color.status.accent` is marked
 * `userConfigurable: true`, and its `light` entry is `null`, so the generated
 * stylesheet defines `--accent-rgb` once under `:root` and never again under
 * `[data-theme='light']`. One inline property on `<html>` therefore outranks the
 * stylesheet in both themes, which is what makes this a runtime override rather than
 * a build step. Konnekt does the same thing in `frontend/src/lib/theme.ts`.
 *
 * This module is deliberately the one place in `src/` where a colour is a *value*
 * rather than a token reference. `.claude/suite.json`'s `no literal hex or px in
 * components` invariant covers `src/components`, `src/routes` and `src/previews` —
 * the places that must reach theming through the token layer. Something has to hold
 * the hex the token layer is being handed, and this is it.
 */

/**
 * Ember (`#fb923c`, Tailwind's orange-400).
 *
 * Chosen against the shared `--bg-base` of `#05060a`, where it carries roughly 9:1
 * contrast — enough for the accent to be readable as text at this UI's 12px body
 * size, and light enough that the `bg-accent` + `text-canvas` pairing (dark text on
 * an accent fill) stays legible the other way round.
 *
 * The pale-yellow half of the palette is not a second accent. It is composed from
 * this one — `rgb(var(--accent-rgb) / 0.2)` and friends — which is the reason the
 * token source stores status colours as channel triplets rather than as colours.
 * A second literal would need a token, and a token would need the umbrella repo.
 */
export const PRODUCT_ACCENT = '#fb923c'

/**
 * A six-digit hex as the space-separated channel triplet `--accent-rgb` holds.
 *
 * Throws rather than returning `NaN NaN NaN`, which paints nothing and looks like a
 * theming bug three layers away from the malformed string that caused it.
 */
export function rgbChannels(hex: string): string {
  const clean = hex.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`not a six-digit hex colour: ${hex}`)
  }
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/**
 * Put the product accent on the root element.
 *
 * Only `--accent-rgb` is written. `--accent` is derived from it in the generated
 * stylesheet (`--accent: rgb(var(--accent-rgb))`), so setting both would be two
 * places to keep in step for no gain — and setting `--accent` alone would leave
 * every `rgb(var(--accent-rgb) / α)` composition in the app still green.
 */
export function applyProductAccent(
  accent: string = PRODUCT_ACCENT,
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--accent-rgb', rgbChannels(accent))
}
