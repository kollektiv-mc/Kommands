import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SPLASH_MS } from '../lib/splashMark'
import { MARK_SHADES } from '../lib/theme'
import { SplashScreen } from './SplashScreen'

// The fake clock fakes requestAnimationFrame too, at 60Hz; jsdom paints no frames of
// its own.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

/** Stub `window.matchMedia`, which jsdom does not implement at all. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
}

test('plays the mark, fades, then removes itself', () => {
  const { container } = render(<SplashScreen />)
  expect(container.querySelector('.splash-overlay svg')).not.toBeNull()

  // The clock holds for several frames before the timeline starts, so the fade has
  // not begun at fadeStart, and has a few frames after it.
  act(() => {
    vi.advanceTimersByTime(SPLASH_MS.fadeStart)
  })
  expect(container.querySelector('.splash-fading')).toBeNull()
  act(() => {
    vi.advanceTimersByTime(10 * 16)
  })
  expect(container.querySelector('.splash-fading')).not.toBeNull()

  // Removed rather than merely faded: an invisible overlay left mounted would be a
  // full-viewport element over an app that is already interactive.
  act(() => {
    vi.advanceTimersByTime(SPLASH_MS.fade)
  })
  expect(container.querySelector('.splash-overlay')).toBeNull()
})

test('builds the block from the prompt outwards', () => {
  const { container } = render(<SplashScreen />)
  const part = (name: string) => container.querySelector(`[data-part="${name}"]`)

  act(() => {
    vi.advanceTimersByTime(7 * 16 + SPLASH_MS.promptIn)
  })
  expect(part('face')).toBeNull()
  expect(part('extrusion')).toBeNull()

  act(() => {
    vi.advanceTimersByTime(SPLASH_MS.extrudeStart)
  })
  expect(part('face')).not.toBeNull()
  expect(part('extrusion')).not.toBeNull()
})

test('is decoration in the accessibility tree, not content', () => {
  const { container } = render(<SplashScreen />)

  // It announces nothing and takes no focus. The app underneath is what a screen
  // reader should be reading.
  expect(container.querySelector('.splash-overlay')?.getAttribute('aria-hidden')).toBe('true')
})

test('wears the light shades on a light ground', () => {
  document.documentElement.setAttribute('data-theme', 'light')
  stubReducedMotion(true)
  const { container } = render(<SplashScreen />)

  expect(container.querySelector('[data-part="brackets"]')?.getAttribute('fill')).toBe(
    MARK_SHADES.light.top,
  )
})

test('shows the finished mark still under reduced motion', () => {
  stubReducedMotion(true)
  const { container } = render(<SplashScreen />)

  expect(container.querySelector('.splash-still')).not.toBeNull()
  expect(container.querySelector('[data-part="extrusion"]')).not.toBeNull()
  expect(container.querySelector('[data-part="brackets"]')?.getAttribute('opacity')).toBe('1')

  act(() => {
    vi.advanceTimersByTime(SPLASH_MS.still)
  })
  expect(container.querySelector('.splash-overlay')).toBeNull()
})
