import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import {
  PRODUCT_ACCENT,
  accentFor,
  applyProductAccent,
  applyTheme,
  hueOf,
  productSkin,
  rgbChannels,
} from './theme'

test('a hex becomes the space-separated channels --accent-rgb holds', () => {
  // Space-separated, not comma-separated: the token source stores status colours this
  // way so `rgb(var(--accent-rgb) / 0.2)` composes alpha from one token. Commas would
  // still parse as a colour and silently break every alpha composition in the app.
  expect(rgbChannels('#fb923c')).toBe('251 146 60')
  expect(rgbChannels('fb923c')).toBe('251 146 60')
})

test('a malformed colour throws rather than resolving to NaN', () => {
  // `NaN NaN NaN` is a valid string and an invalid colour: it paints nothing, in a
  // component three layers from the bad value. Failing here names the cause.
  expect(() => rgbChannels('#fb923')).toThrow()
  expect(() => rgbChannels('orange')).toThrow()
})

test('the accent is written to the root element as channels', () => {
  const root = document.createElement('html')
  applyProductAccent(PRODUCT_ACCENT, root)

  expect(root.style.getPropertyValue('--accent-rgb')).toBe('251 146 60')
  // --accent is derived from --accent-rgb by the generated stylesheet. Writing it here
  // too would be a second place to keep in step, and writing it *instead* would leave
  // every alpha composition reading the stylesheet's green.
  expect(root.style.getPropertyValue('--accent')).toBe('')
})

test('the product accent is the one Kommands ships, not the shared default', () => {
  // The suite's shared token source defaults accent to Konnekt's green (#4ade80).
  // This assertion is the statement that Kommands overrides it — if the override is
  // ever dropped, the app silently becomes green and looks like the other product.
  expect(PRODUCT_ACCENT).toBe('#fb923c')
  expect(rgbChannels(PRODUCT_ACCENT)).not.toBe(rgbChannels('#4ade80'))
})

test('the canvas takes the accent hue, so retinting one retints the other', () => {
  // The property a pair of hard-coded hexes would not have. Konnekt's green and this
  // product's ember must not produce the same ground, or the skin is decoration rather
  // than identity.
  expect(hueOf('#fb923c')).toBeCloseTo(27, 0)
  expect(productSkin('dark', '#fb923c').base).not.toBe(productSkin('dark', '#4ade80').base)
})

test('the dark canvas carries white text far past what this UI needs', () => {
  // 12px body text on a full-screen ground. WCAG AA asks 4.5:1; a dense UI wants more.
  // Asserted rather than eyeballed because the skin is computed, so a nudge to the
  // lightness in SKIN is a one-character change that could quietly cross the line.
  expect(contrast(productSkin('dark').base, '#ffffff')).toBeGreaterThan(7)
  // And the accent has to stay legible *on* the ground it now shares a hue with —
  // the failure mode of tinting a canvas toward its own accent.
  expect(contrast(productSkin('dark').base, PRODUCT_ACCENT)).toBeGreaterThan(4.5)
})

test('bg-overlay is derived from the other two, not chosen', () => {
  // kollektiv/design/README.md defines bg-overlay as bg-elevated composited over
  // bg-base. Recomputing it here is what keeps the two agreeing where a panel happens
  // to sit on the canvas; picking a fourth colour by eye is how that is lost.
  const { base, elevated, overlay } = productSkin('dark')
  const [er, eg, eb] = (/rgba\((\d+), (\d+), (\d+)/.exec(elevated) ?? []).slice(1).map(Number)
  const [br, bg, bb] = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16))
  const expected = [
    [er, br],
    [eg, bg],
    [eb, bb],
  ].map(([e, b]) => Math.round(e! * 0.82 + b! * 0.18))
  expect(overlay).toBe(`#${expected.map((c) => c.toString(16).padStart(2, '0')).join('')}`)
})

test('setting the theme repaints the canvas, because an inline skin outranks the sheet', () => {
  // The trap this guards: unlike --accent-rgb, the three canvas tokens *do* have
  // [data-theme='light'] values in the generated sheet. A skin written once at startup
  // would outrank them, and light mode would wear the dark canvas.
  const root = document.createElement('html')

  applyTheme('dark', root)
  const dark = root.style.getPropertyValue('--bg-base')
  applyTheme('light', root)

  expect(root.getAttribute('data-theme')).toBe('light')
  expect(root.style.getPropertyValue('--bg-base')).not.toBe(dark)
  expect(root.style.getPropertyValue('--bg-overlay')).not.toBe('')
})

test('the light theme darkens the accent, because the light canvas would swallow it', () => {
  // 2.1:1 before this existed. The wordmark in the title bar is text-accent and is the
  // only route back to the dashboard from inside the editor, and `bg-accent` +
  // `text-canvas` inverts to near-white on orange — worse still.
  const light = productSkin('light').base
  expect(contrast(light, PRODUCT_ACCENT)).toBeLessThan(3)
  expect(contrast(light, accentFor('light'))).toBeGreaterThan(4.5)

  // Same hue, so it reads as the same accent at two lightnesses rather than as a
  // second colour. This is the assertion that a future adjustment cannot quietly
  // become "light mode is a different product".
  expect(hueOf(accentFor('light'))).toBeCloseTo(hueOf(PRODUCT_ACCENT), 0)
  // And dark is left exactly as chosen.
  expect(accentFor('dark')).toBe(PRODUCT_ACCENT)
})

test('applying a theme is one call, not three property writes at call sites', () => {
  // The accent, the canvas and the attribute are one decision. Splitting them across
  // two call sites is how a half-applied theme reaches the first paint — which it did:
  // main.tsx applied the accent and the theme separately, and light mode painted an
  // ember wordmark on an ember-tinted white.
  const root = document.createElement('html')
  applyTheme('light', root)

  expect(root.style.getPropertyValue('--accent-rgb')).toBe(rgbChannels(accentFor('light')))
  applyTheme('dark', root)
  expect(root.style.getPropertyValue('--accent-rgb')).toBe(rgbChannels(PRODUCT_ACCENT))
})

test("the shell's launch colour is the skin's, not a hex someone typed twice", () => {
  // main.go paints the window before the webview has rendered anything, so its
  // BackgroundColour has to be --bg-base or launch shows a coloured flash. Neither the
  // token pipeline nor the skin can reach Go, so the value is restated there by hand —
  // and a restated value is one that drifts. This is the check that it has not.
  const go = readFileSync('main.go', 'utf8')
  const match = /BackgroundColour: &options\.RGBA\{R: (\d+), G: (\d+), B: (\d+), A: 255\}/.exec(go)
  expect(match).not.toBeNull()

  const base = productSkin('dark').base
  const expected = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16))
  expect(match!.slice(1, 4).map(Number)).toEqual(expected)
})

/** WCAG relative-luminance contrast between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const [r, g, bl] = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
