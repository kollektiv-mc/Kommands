import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AppShell } from './AppShell'
import { renderWithRouter } from '../test-router'

beforeEach(() => {
  window.localStorage.clear()
})

/**
 * Pretend Wails has attached its runtime, which is what `hasWindowChrome()` probes.
 * Handing one in beats mocking `lib/window`: the shell then takes the same branch the
 * desktop build takes, rather than one a spy invented.
 */
function withWindowChrome() {
  ;(window as { runtime?: unknown }).runtime = {
    WindowMinimise: () => {},
    WindowToggleMaximise: () => {},
    WindowIsMaximised: () => Promise.resolve(false),
    Quit: () => {},
  }
}

afterEach(() => {
  delete (window as { runtime?: unknown }).runtime
})

/** The framing element the web surfaces get: the panel that holds the title bar. */
function frame(): Element | null {
  return document.querySelector('main')?.closest('.rounded-panel') ?? null
}

test('on the web the app is a panel on the page, not the page', async () => {
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )

  // A gutter and a hairline set the app off the browser's own chrome. Without them the
  // title bar sits flush against the tab strip.
  const framed = frame()
  expect(framed).not.toBeNull()
  expect(framed!.className).toContain('rounded-panel')
  expect(framed!.className).toContain('border-hairline')
  // Full width: the dashboard fills whatever room it is given.
  expect(framed!.className).not.toMatch(/max-w-/)
})

test('in the desktop window the operating system already draws the gutter', async () => {
  // The negative control, and the one that matters: without it the test above passes
  // just as well against a frame drawn on every surface, which would put a border
  // around a border in the one place the window manager has already framed the app.
  withWindowChrome()
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )

  expect(frame()).toBeNull()
  expect(screen.getByText('content')).toBeDefined()
})

test('renders the product name and its children', async () => {
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )
  expect(screen.getByText('Kommands')).toBeDefined()
  expect(screen.getByText('content')).toBeDefined()
})

test('the product name is the way back to the dashboard', async () => {
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )
  // The editor fills the viewport, so this is the only route back to what has been
  // saved. A label here rather than a link would strand anyone who opened a command.
  expect(screen.getByRole('link', { name: 'Kommands' }).getAttribute('href')).toBe('/dashboard')
})

test('the shell owns the settings dialog, because it is what stays mounted', async () => {
  const user = userEvent.setup()
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )

  expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Settings' }))

  // Owned here rather than by a route: the shell is the only thing mounted on every
  // route, and a dialog owned by a route would close itself the moment someone
  // navigated from inside it.
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined()
  await user.click(screen.getByRole('button', { name: 'Close settings' }))
  expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
})

test('choosing a theme applies it and remembers it', async () => {
  const user = userEvent.setup()
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )

  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('radio', { name: 'light' }))

  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  // The canvas has to move with the attribute. An inline skin outranks the generated
  // stylesheet in both themes, so flipping data-theme alone would leave light mode
  // wearing the dark canvas with the sheet's own light values unreachable.
  expect(document.documentElement.style.getPropertyValue('--bg-base')).not.toBe('')
  expect(window.localStorage.getItem('kommands.theme')).toBe('light')
})
