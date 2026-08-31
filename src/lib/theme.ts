/**
 * Kommands' product identity, applied at runtime: the accent, and the canvas it sits on.
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
 * The **skin** below is the same mechanism one step further, and it is sanctioned by
 * the same document that forbids editing the vendored source. `kollektiv/design/README.md`
 * § Two things not held here: "Konnekt's `BUILTIN_SKINS` … override shared token *names*
 * with product-local values. They are a desktop-app feature, not a shared design
 * decision, and they stay in `Konnekt/frontend/src/lib/theme.ts`." A warm canvas is
 * Kommands' equivalent: a product-local look, not a change to what the suite means by
 * `bg-base`.
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
 * an accent fill) stays legible the other way round. Against the warmed base the
 * skin below produces it is a shade lower and still well clear.
 *
 * The pale-yellow half of the palette is not a second accent. It is composed from
 * this one — `rgb(var(--accent-rgb) / 0.2)` and friends — which is the reason the
 * token source stores status colours as channel triplets rather than as colours.
 * A second literal would need a token, and a token would need the umbrella repo.
 */
export const PRODUCT_ACCENT = '#fb923c'

/** The two themes the generated stylesheet defines. */
export type Theme = 'dark' | 'light'

/**
 * How translucent an elevated surface is.
 *
 * Not invented here — it is `color.surface.bg-elevated.alpha` in the shared token
 * source, restated because the skin recomputes the colour underneath it and the
 * alpha has to survive that. `kollektiv/design/README.md` § Why there are two
 * elevated surfaces explains what the value buys; changing it here alone would
 * silently disagree with the source.
 */
const ELEVATED_ALPHA = 0.82

/**
 * The canvas, as saturation and lightness at the accent's own hue.
 *
 * Hue is **not** stored. It is read from the accent at apply time, so the ground and
 * the thing it accents can never drift apart — retint the accent and the whole app
 * moves with it, which is the property a pair of hard-coded hexes would not have.
 *
 * Saturation and lightness are what stay fixed, because they are the part carrying
 * the design decision rather than the identity. They hold the shared ramp's shape —
 * base darkest, elevated one step up — while lifting both far enough off the shared
 * `#05060a` for a hue to be visible at all. That lift is the whole point: at 3%
 * lightness every hue is black, so a tint alone would have changed nothing anyone
 * could see.
 *
 * Dark lands on `#1c1612` / `#2a221c`, which carries white text at roughly 18:1 —
 * well past the 7:1 this UI's 12px body size wants, and past the 4.5:1 WCAG AA asks
 * for. Light is the same construction against a near-white, so the pair stays a
 * theme swap rather than two unrelated palettes.
 */
/**
 * The accent, restated for the light theme as saturation and lightness at its own hue.
 *
 * Ember at `#fb923c` is chosen against a near-black and carries roughly 7.9:1 there. On
 * the light canvas the same colour is **2.1:1** — below the 3:1 that even large text
 * asks for. That is not a theoretical figure: the wordmark in the title bar is
 * `text-accent`, and it is the only route back to the dashboard from inside the editor.
 * The `bg-accent` + `text-canvas` pairing is worse still, because it inverts to
 * near-white on orange.
 *
 * Darkening it here is the shared source's own convention rather than a departure from
 * it. `tokens.json` already gives `success`, `warning` and `danger` darker light-mode
 * values "for contrast against a light canvas"; `accent` is the one status colour left
 * out, and only because it is `userConfigurable` and a generator "must not bake it in
 * as fixed". This product configures it at runtime, so the adjustment the source
 * declined to make is this module's to make — at the same hue, so it is recognisably
 * the same accent rather than a second one.
 *
 * Lands on `#ab5107`, which is 5.0:1 against the light base in both directions.
 */
const LIGHT_ACCENT: [number, number] = [0.92, 0.35]

const SKIN: Record<Theme, { base: [number, number]; elevated: [number, number] }> = {
  // [saturation, lightness]
  dark: { base: [0.22, 0.09], elevated: [0.2, 0.137] },
  light: { base: [0.33, 0.97], elevated: [0.26, 0.94] },
}

/**
 * A six-digit hex as the space-separated channel triplet `--accent-rgb` holds.
 *
 * Throws rather than returning `NaN NaN NaN`, which paints nothing and looks like a
 * theming bug three layers away from the malformed string that caused it.
 */
export function rgbChannels(hex: string): string {
  return channelsOf(hex).join(' ')
}

/** The three channels of a six-digit hex, as numbers. Throws on anything else. */
function channelsOf(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`not a six-digit hex colour: ${hex}`)
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/**
 * The hue of a colour, in degrees.
 *
 * Hue only — the accent's own saturation and lightness are deliberately discarded,
 * because they describe a colour meant to be *read against* the canvas rather than
 * to be it. Taking all three would make the background the accent, at which point
 * the accent has nothing left to stand out from.
 *
 * A grey has no hue; `0` is as good an answer as any other and is never reached in
 * practice, since an accent nobody can distinguish from the border colour is a
 * different problem.
 */
export function hueOf(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((c) => c / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const span = max - Math.min(r, g, b)
  if (span === 0) return 0
  const sextant =
    max === r
      ? (g - b) / span + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / span + 2
        : (r - g) / span + 4
  return sextant * 60
}

/** HSL to 0–255 channels, rounded. The standard conversion, written out rather than imported. */
function hsl(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const sextant = (((hue % 360) + 360) % 360) / 60
  const second = chroma * (1 - Math.abs((sextant % 2) - 1))
  const floor = lightness - chroma / 2
  const [r, g, b]: [number, number, number] =
    sextant < 1
      ? [chroma, second, 0]
      : sextant < 2
        ? [second, chroma, 0]
        : sextant < 3
          ? [0, chroma, second]
          : sextant < 4
            ? [0, second, chroma]
            : sextant < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]
  return [
    Math.round((r + floor) * 255),
    Math.round((g + floor) * 255),
    Math.round((b + floor) * 255),
  ]
}

/** `#rrggbb` from three 0–255 channels. */
function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The three canvas colours for a theme, at an accent's hue.
 *
 * Exported for its test and for anything that needs the values without touching the
 * DOM — the Go shell's launch background is the same three numbers, and a test is
 * how the two are held together (see `main.go`'s `BackgroundColour`).
 *
 * `overlay` is **derived, never chosen**. `kollektiv/design/README.md` defines
 * `bg-overlay` as `bg-elevated` composited over `bg-base` — the colour an elevated
 * panel already resolves to when it happens to sit on the canvas — so computing it
 * here keeps the two agreeing exactly as the shared source intends. Picking a fourth
 * colour by eye is how that relationship gets quietly lost.
 */
export function productSkin(
  theme: Theme,
  accent: string = PRODUCT_ACCENT,
): { base: string; elevated: string; overlay: string } {
  const hue = hueOf(accent)
  const preset = SKIN[theme]
  const base = hsl(hue, preset.base[0], preset.base[1])
  const elevated = hsl(hue, preset.elevated[0], preset.elevated[1])
  const overlay = base.map((channel, i) =>
    Math.round(elevated[i]! * ELEVATED_ALPHA + channel * (1 - ELEVATED_ALPHA)),
  ) as [number, number, number]
  return {
    base: toHex(base),
    elevated: `rgba(${elevated.join(', ')}, ${ELEVATED_ALPHA})`,
    overlay: toHex(overlay),
  }
}

/**
 * The accent as a theme wears it: ember on dark, a darkened ember on light.
 *
 * Hue is preserved exactly, so the two are the same accent at two lightnesses rather
 * than two colours. A user-chosen accent goes through the same adjustment, which is
 * why this takes one rather than reading `PRODUCT_ACCENT` itself.
 */
export function accentFor(theme: Theme, accent: string = PRODUCT_ACCENT): string {
  return theme === 'dark' ? accent : toHex(hsl(hueOf(accent), LIGHT_ACCENT[0], LIGHT_ACCENT[1]))
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

/**
 * Set the theme, and repaint everything the theme decides.
 *
 * **The single entry point**, deliberately. The accent, the canvas and the attribute
 * are one decision wearing three property writes, and splitting them across two call
 * sites is how a half-applied theme happens.
 *
 * They have to happen together because the skin is an **inline** override, and an
 * inline property outranks the stylesheet in both themes. That is exactly what makes
 * the accent override work — and it is a trap for the canvas, because unlike the
 * accent, the three canvas tokens *do* have `[data-theme='light']` values in the
 * generated sheet. Writing the dark skin once at startup and then flipping
 * `data-theme` would leave light mode wearing the dark canvas, with the stylesheet's
 * own light values outranked and unreachable. So the attribute is never set without
 * the skin being rewritten for it.
 */
export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
  accent: string = PRODUCT_ACCENT,
): void {
  const skin = productSkin(theme, accent)
  root.setAttribute('data-theme', theme)
  applyProductAccent(accentFor(theme, accent), root)
  root.style.setProperty('--bg-base', skin.base)
  root.style.setProperty('--bg-elevated', skin.elevated)
  root.style.setProperty('--bg-overlay', skin.overlay)
}
