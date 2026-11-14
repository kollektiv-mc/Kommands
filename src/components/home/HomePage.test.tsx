import { afterEach, expect, test } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../test-router'
import { HomePage } from './HomePage'
import { cameFromSite } from '../../lib/siteEntry'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

test('the home page names itself for a screen reader and leads to the app', async () => {
  await renderWithRouter(<HomePage />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
    'Kommands, a Minecraft command generator',
  )
  const dashboards = screen.getAllByRole('link', { name: 'Open Dashboard' })
  expect(dashboards.map((a) => a.getAttribute('href'))).toEqual(['/dashboard', '/dashboard'])
  const downloads = screen.getAllByRole('link', { name: 'Download' })
  expect(downloads.map((a) => a.getAttribute('href'))).toEqual(['/download', '/download'])
  expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe(
    'https://github.com/kollektiv-mc/Kommands',
  )
})

test('the hero is hidden from assistive technology', async () => {
  const { container } = await renderWithRouter(<HomePage />)
  expect(container.querySelector('.hero')?.getAttribute('aria-hidden')).toBe('true')
})

test('showing the site tells the app not to replay its splash', async () => {
  await renderWithRouter(<HomePage />)
  expect(cameFromSite()).toBe(true)
})

test('the generators block has its four tiles', async () => {
  await renderWithRouter(<HomePage />)
  const tiles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
  expect(tiles).toEqual(['78 Commands', '3D Editor', 'Execute Builder', 'Command Dashboard'])
})
