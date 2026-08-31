import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { TitleBar } from './TitleBar'
import { renderWithRouter } from '../test-router'

/** Attach a stub Wails runtime, as the desktop webview does. Returns its spies. */
function withWindowRuntime() {
  const runtime = {
    WindowMinimise: vi.fn(),
    WindowToggleMaximise: vi.fn(),
    WindowIsMaximised: vi.fn().mockResolvedValue(false),
    Quit: vi.fn(),
  }
  ;(window as unknown as { runtime: unknown }).runtime = runtime
  return runtime
}

afterEach(() => {
  delete (window as unknown as { runtime?: unknown }).runtime
})

test('the wordmark is in the bar, and is still the way back to the dashboard', async () => {
  await renderWithRouter(<TitleBar onOpenSettings={() => {}} />)

  // The editor covers the whole viewport, so this is the only route back to what has
  // been saved. A label here rather than a link would strand anyone who opened a
  // command — which is why it survived the move out of the old header.
  expect(screen.getByRole('link', { name: 'Kommands' }).getAttribute('href')).toBe('/')
})

test('the version line is gone', async () => {
  await renderWithRouter(<TitleBar onOpenSettings={() => {}} />)

  // "Java Edition 1.21.1" was a claim the app makes everywhere else and better: every
  // command page serialises for the target version. A version stated once in chrome is
  // the copy that goes stale the day a second version lands.
  expect(screen.queryByText(/1\.21\.1/)).toBeNull()
})

test('a browser gets the settings gear and no window controls', async () => {
  // The hosted site, and the standalone build's --serve browser surface. Neither has a
  // window to minimise, and offering a control that cannot work is the failure
  // distribution.md warns about, one level down.
  await renderWithRouter(<TitleBar onOpenSettings={() => {}} />)

  expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Minimize window' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Close window' })).toBeNull()
})

test('the desktop window gets the full set, wired to the runtime', async () => {
  const runtime = withWindowRuntime()
  const user = userEvent.setup()
  await renderWithRouter(<TitleBar onOpenSettings={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Minimize window' }))
  expect(runtime.WindowMinimise).toHaveBeenCalled()

  // Quit, not a window close: Wails routes it through OnBeforeClose, which is where a
  // shutdown hook would live if this app grew one.
  await user.click(screen.getByRole('button', { name: 'Close window' }))
  expect(runtime.Quit).toHaveBeenCalled()
})

test('the maximize glyph flips on click rather than waiting on the round trip', async () => {
  const runtime = withWindowRuntime()
  const user = userEvent.setup()
  await renderWithRouter(<TitleBar onOpenSettings={() => {}} />)

  await user.click(await screen.findByRole('button', { name: 'Maximize window' }))

  expect(runtime.WindowToggleMaximise).toHaveBeenCalled()
  // The state sync is debounced behind a resize event by 120ms, and 120ms of the old
  // icon reads as a dropped click. This is the optimistic flip that avoids it.
  expect(screen.getByRole('button', { name: 'Restore window' })).toBeDefined()
})

test('the gear reports to whoever owns the dialog', async () => {
  const onOpenSettings = vi.fn()
  const user = userEvent.setup()
  await renderWithRouter(<TitleBar onOpenSettings={onOpenSettings} />)

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  // The bar does not own the dialog. AppShell does, because it is the only thing
  // mounted on every route — a dialog owned by a route would close itself the moment
  // someone navigated from inside it.
  expect(onOpenSettings).toHaveBeenCalled()
})
