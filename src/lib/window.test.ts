import { afterEach, expect, test, vi } from 'vitest'
import {
  hasWindowChrome,
  minimiseWindow,
  quitWindow,
  toggleMaximiseWindow,
  windowIsMaximised,
} from './window'

afterEach(() => {
  delete (window as unknown as { runtime?: unknown }).runtime
})

test('no runtime means no window chrome, and every command is a no-op', async () => {
  // The hosted site and the --serve browser surface. Nothing here holds state to
  // revert or writes anything, so with no window there is nothing to report and
  // nothing to retry — these must not throw into the render that called them.
  expect(hasWindowChrome()).toBe(false)
  expect(() => {
    minimiseWindow()
    toggleMaximiseWindow()
    quitWindow()
  }).not.toThrow()
  expect(await windowIsMaximised()).toBe(false)
})

test('a runtime is the whole of the check', async () => {
  ;(window as unknown as { runtime: unknown }).runtime = {
    WindowMinimise: vi.fn(),
    WindowToggleMaximise: vi.fn(),
    WindowIsMaximised: vi.fn().mockResolvedValue(true),
    Quit: vi.fn(),
  }

  // Wails injects this into the webview independently of any Go bindings, which is
  // what lets app.go keep binding no methods at all: nothing here is an *application*
  // method, so the HTTP API stays the one JS↔Go surface.
  expect(hasWindowChrome()).toBe(true)
  expect(await windowIsMaximised()).toBe(true)
})

test('a runtime that rejects is not a maximised window', async () => {
  // Belt to the braces: the controls are not rendered without hasWindowChrome(), but a
  // rejected probe must resolve to an answer rather than surface as an unhandled
  // rejection in a component that only wanted to pick a glyph.
  ;(window as unknown as { runtime: unknown }).runtime = {
    WindowIsMaximised: () => Promise.reject(new Error('no window')),
  }
  expect(await windowIsMaximised()).toBe(false)
})
