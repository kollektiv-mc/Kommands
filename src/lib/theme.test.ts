import { expect, test } from 'vitest'
import { PRODUCT_ACCENT, applyProductAccent, rgbChannels } from './theme'

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
