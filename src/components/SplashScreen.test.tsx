import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SplashScreen } from './SplashScreen'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Stub `window.matchMedia`, which jsdom does not implement at all. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
}

test('shows the product name, then removes itself', () => {
  vi.useFakeTimers()
  render(<SplashScreen />)

  expect(screen.getByText('Kommands')).toBeDefined()

  act(() => {
    vi.advanceTimersByTime(1000)
  })
  // Removed rather than merely faded: the overlay covers a page that is already
  // interactive, so an invisible one left mounted would be a full-viewport element
  // sitting over the app. `pointer-events: none` makes that harmless; unmounting
  // makes it absent.
  expect(screen.queryByText('Kommands')).toBeNull()
})

test('is decoration in the accessibility tree, not content', () => {
  vi.useFakeTimers()
  const { container } = render(<SplashScreen />)

  // getByText finds it, but nothing in the a11y tree does — it announces nothing and
  // takes no focus. The app underneath is what a screen reader should be reading.
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  expect(screen.queryByRole('heading')).toBeNull()
})

test('reduced motion skips the splash entirely rather than freezing it', () => {
  stubReducedMotion(true)
  render(<SplashScreen />)

  // Not "rendered without its animation": there is no startup work to mask here, so
  // the honest answer to a request for less motion is the app, immediately.
  expect(screen.queryByText('Kommands')).toBeNull()
})

test('no reduced-motion preference still shows it', () => {
  vi.useFakeTimers()
  stubReducedMotion(false)
  render(<SplashScreen />)

  expect(screen.getByText('Kommands')).toBeDefined()
})
