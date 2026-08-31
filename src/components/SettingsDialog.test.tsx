import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { SettingsDialog, initialTheme } from './SettingsDialog'
import { configureProbe } from '../storage/probe'
import { configureStorage } from '../stores/useSavedCommandsStore'
import { localStorageBackend } from '../storage/local'
import { renderWithRouter } from '../test-router'

beforeEach(() => {
  window.localStorage.clear()
  configureProbe(null)
  configureStorage(localStorageBackend(window.localStorage))
})

test('the dialog offers only settings this app actually has', async () => {
  await renderWithRouter(<SettingsDialog theme="dark" onTheme={() => {}} onClose={() => {}} />)

  // Two sections and no more, which is the point of the file rather than a stage it is
  // passing through. A gear that opens a page of invented preferences is worse than a
  // gear that opens nothing.
  expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Build' })).toBeDefined()
  expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeDefined()
})

test('the theme choice is one setting with two values, not two toggles', async () => {
  const onTheme = vi.fn()
  const user = userEvent.setup()
  await renderWithRouter(<SettingsDialog theme="dark" onTheme={onTheme} onClose={() => {}} />)

  // radio, not two buttons: a screen reader reading them as independent toggles would
  // let someone press "off" on both and land in no theme at all.
  expect(screen.getByRole('radio', { name: 'dark' }).getAttribute('aria-checked')).toBe('true')
  await user.click(screen.getByRole('radio', { name: 'light' }))
  expect(onTheme).toHaveBeenCalledWith('light')
})

test('the web build names itself, and claims no shell it does not have', async () => {
  await renderWithRouter(<SettingsDialog theme="dark" onTheme={() => {}} onClose={() => {}} />)

  // distribution.md § The split must be visible asks for the difference between the
  // builds to be stated rather than discovered. The dashboard states the consequence
  // ("linking needs the standalone build"); this states the cause.
  expect(screen.getByText('Web')).toBeDefined()
  expect(screen.queryByText('Shell')).toBeNull()
  expect(screen.queryByText('Konnekt')).toBeNull()
})

test('the standalone build reports what the probe found', async () => {
  configureProbe({ shellVersion: '0.1.0', konnektPresent: true })
  const file = localStorageBackend(window.localStorage)
  configureStorage({ ...file, kind: 'file' })
  await renderWithRouter(<SettingsDialog theme="dark" onTheme={() => {}} onClose={() => {}} />)

  expect(screen.getByText('Standalone')).toBeDefined()
  expect(screen.getByText('0.1.0')).toBeDefined()
  expect(screen.getByText('detected')).toBeDefined()
})

test('Escape closes it', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  await renderWithRouter(<SettingsDialog theme="dark" onTheme={() => {}} onClose={onClose} />)

  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('the app opens dark, not in whatever the OS prefers', async () => {
  // `prefers-color-scheme` would be right for a site with no opinion. This app has
  // one: it is dark-first by design language, and light is the alternative rather than
  // the peer. Reading the OS here would put half of all first-time visitors in the
  // mode the design was not drawn for.
  expect(initialTheme()).toBe('dark')
  window.localStorage.setItem('kommands.theme', 'light')
  expect(initialTheme()).toBe('light')
  // And a value that is not a theme is not a theme.
  window.localStorage.setItem('kommands.theme', 'sepia')
  expect(initialTheme()).toBe('dark')
})
