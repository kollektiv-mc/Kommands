import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FontSettings } from './FontSettings'
import { configureProbe } from '../storage/probe'
import { readFonts } from '../storage/preferences'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('style')
  configureProbe(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as Window & { queryLocalFonts?: unknown }).queryLocalFonts
})

const options = () =>
  Array.from(document.querySelectorAll('datalist option')).map((option) =>
    option.getAttribute('value'),
  )

test('one field per font token, all empty by default', () => {
  render(<FontSettings />)
  for (const label of ['Body', 'Titles', 'Wordmark', 'Code']) {
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('')
  }
})

test('typing a family applies it at once and remembers it; clearing restores the default', async () => {
  const user = userEvent.setup()
  render(<FontSettings />)
  const code = screen.getByLabelText('Code')

  await user.type(code, 'Fira Code')
  expect(document.documentElement.style.getPropertyValue('--font-mono')).toBe('"Fira Code"')
  expect(readFonts()).toEqual({ mono: 'Fira Code' })

  await user.clear(code)
  expect(document.documentElement.style.getPropertyValue('--font-mono')).toBe('')
  expect(readFonts()).toEqual({})
})

test('the standalone build suggests the families the shell found', async () => {
  configureProbe({ shellVersion: '0.0.0-test', konnektPresent: false })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ families: ['Alpha', 'Beta'] }))),
  )
  render(<FontSettings />)
  await waitFor(() => expect(options()).toEqual(['Alpha', 'Beta']))
  expect(screen.queryByRole('button', { name: 'List installed fonts' })).toBeNull()
})

test('a browser with the Local Font Access API lists fonts only when asked', async () => {
  const query = vi.fn(async () => [{ family: 'Gamma' }])
  ;(window as Window & { queryLocalFonts?: unknown }).queryLocalFonts = query
  const user = userEvent.setup()
  render(<FontSettings />)

  // Asked for on a click, not on open: the browser shows a permission prompt, and
  // refuses one that no gesture started.
  const ask = await screen.findByRole('button', { name: 'List installed fonts' })
  expect(query).not.toHaveBeenCalled()
  await user.click(ask)
  await waitFor(() => expect(options()).toEqual(['Gamma']))
})

test('a browser that cannot list fonts says so and still takes a typed name', async () => {
  render(<FontSettings />)
  expect(await screen.findByText(/cannot list fonts/)).toBeDefined()
})
