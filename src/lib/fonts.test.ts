import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  applyFonts,
  browserCanListFonts,
  browserFamilies,
  quoteFamily,
  shellFamilies,
} from './fonts'
import { configureProbe } from '../storage/probe'

beforeEach(() => {
  document.documentElement.removeAttribute('style')
  configureProbe(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as Window & { queryLocalFonts?: unknown }).queryLocalFonts
})

test('a family name is always a quoted CSS string, escapes included', () => {
  expect(quoteFamily('Inter')).toBe('"Inter"')
  expect(quoteFamily('Font-Awesome 6')).toBe('"Font-Awesome 6"')
  expect(quoteFamily('Say "hi" \\ bye')).toBe('"Say \\"hi\\" \\\\ bye"')
})

test('a chosen family goes in front of the token stack; an unchosen role is left alone', () => {
  const root = document.documentElement
  root.style.setProperty('--font-title', '"Leftover"')
  applyFonts({ sans: '  Inter ', mono: 'Fira Code' }, root)

  expect(root.style.getPropertyValue('--font-sans')).toBe('"Inter"')
  expect(root.style.getPropertyValue('--font-mono')).toBe('"Fira Code"')
  // Rebuilt rather than patched: a role no longer chosen loses its old override.
  expect(root.style.getPropertyValue('--font-title')).toBe('')
  expect(root.style.getPropertyValue('--font-display')).toBe('')
})

test('an empty or blank name means the default', () => {
  const root = document.documentElement
  applyFonts({ sans: 'Inter' }, root)
  applyFonts({ sans: '   ' }, root)
  expect(root.style.getPropertyValue('--font-sans')).toBe('')
})

test('the web build asks no shell', async () => {
  const fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  expect(await shellFamilies()).toBeNull()
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('the standalone build reads the shell list and keeps only strings', async () => {
  configureProbe({ shellVersion: '0.0.0-test', konnektPresent: false })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ families: ['Alpha', 3, 'Beta'] }))),
  )
  expect(await shellFamilies()).toEqual(['Alpha', 'Beta'])
})

test('a failing shell request is an empty list, not an error', async () => {
  configureProbe({ shellVersion: '0.0.0-test', konnektPresent: false })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 500 })),
  )
  expect(await shellFamilies()).toEqual([])
})

test('the browser list is deduplicated across styles and sorted', async () => {
  expect(browserCanListFonts()).toBe(false)
  ;(window as Window & { queryLocalFonts?: unknown }).queryLocalFonts = async () => [
    { family: 'beta' },
    { family: 'Alpha' },
    { family: 'Alpha' },
  ]
  expect(browserCanListFonts()).toBe(true)
  expect(await browserFamilies()).toEqual(['Alpha', 'beta'])
})

test('a refused permission is an empty list', async () => {
  ;(window as Window & { queryLocalFonts?: unknown }).queryLocalFonts = async () => {
    throw new DOMException('denied', 'NotAllowedError')
  }
  expect(await browserFamilies()).toEqual([])
})
