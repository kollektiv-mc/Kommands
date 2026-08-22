import { describe, expect, test } from 'vitest'
import { Color } from 'three'
import { colorFromChannels } from './color'

/**
 * The token layer and Three.js, agreeing.
 *
 * This suite exists because the obvious implementation is silently wrong in two
 * different ways, and both produce a picture rather than an error.
 */

describe('a channel triplet becomes the colour the token names', () => {
  test('--accent-rgb produces --accent, exactly', () => {
    // 74 222 128 is the accent in tokens.source.json, and the hex below is what
    // src/styles/tokens.css resolves it to. If these ever disagree the preview is
    // drawing a colour the design system does not contain.
    expect(colorFromChannels('74 222 128')?.getHexString()).toBe('4ade80')
  })

  test('the comma-separated spelling works too, since both are legal CSS', () => {
    expect(colorFromChannels('74, 222, 128')?.getHexString()).toBe('4ade80')
  })

  test('the string form Three cannot read is the one this function exists to avoid', () => {
    // The bug, pinned. `--accent` is `rgb(74 222 128)`; handing that to Three yields
    // white, and white renders perfectly happily.
    expect(new Color('rgb(74 222 128)').getHexString()).toBe('ffffff')
    expect(colorFromChannels('74 222 128')?.getHexString()).not.toBe('ffffff')
  })

  test('the working colour space is not the one the channels are in', () => {
    // The second wrong answer: sRGB channels read as linear-sRGB give a plausible,
    // visibly different green. Asserted so a refactor cannot quietly drop the argument.
    expect(new Color().setRGB(74 / 255, 222 / 255, 128 / 255).getHexString()).toBe('93f0bc')
  })

  test('anything that is not three channels is undefined rather than black', () => {
    // Falling back to a colour would put an invented literal on screen, which is the
    // thing the styling rule forbids. Absent means "let the material decide".
    for (const bad of ['', '74 222', '74 222 128 99', 'red', '74 222 blue', '-1 0 0', '0 0 999']) {
      expect(colorFromChannels(bad)).toBeUndefined()
    }
  })
})
