import { expect, test } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '../../test-router'
import { DownloadPage } from './DownloadPage'

const SNAPSHOT = 'https://github.com/kollektiv-mc/Kommands/releases'

test('Windows is the first download and points at the snapshot installer', async () => {
  await renderWithRouter(<DownloadPage />, '/download')
  const windows = screen.getByRole('link', { name: 'Windows' })
  expect(windows.getAttribute('href')).toBe(
    `${SNAPSHOT}/download/snapshot/kommands-windows-amd64-installer.exe`,
  )
  expect(windows.className).toContain('primary')
})

test('macOS points at the snapshot DMG', async () => {
  await renderWithRouter(<DownloadPage />, '/download')
  expect(screen.getByRole('link', { name: 'macOS' }).getAttribute('href')).toBe(
    `${SNAPSHOT}/download/snapshot/kommands-darwin-universal.dmg`,
  )
})

test('Linux opens in place into its two builds', async () => {
  const user = userEvent.setup()
  await renderWithRouter(<DownloadPage />, '/download')
  const linux = screen.getByRole('button', { name: 'Linux' })
  expect(linux.getAttribute('aria-expanded')).toBe('false')
  const binary = screen.getByText('Linux binary').closest('a')
  expect(binary?.getAttribute('tabindex')).toBe('-1')
  await user.click(linux)
  expect(linux.getAttribute('aria-expanded')).toBe('true')
  expect(binary?.hasAttribute('tabindex')).toBe(false)
  expect(binary?.getAttribute('href')).toBe(`${SNAPSHOT}/download/snapshot/kommands-linux-amd64`)
})

test('the header leads back to the dashboard', async () => {
  await renderWithRouter(<DownloadPage />, '/download')
  expect(screen.getByRole('link', { name: 'Open Dashboard' }).getAttribute('href')).toBe(
    '/dashboard',
  )
})
