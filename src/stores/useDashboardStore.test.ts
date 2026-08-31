import { beforeEach, expect, test } from 'vitest'
import { useDashboardStore } from './useDashboardStore'
import { DEFAULT_PLACED } from '../components/dashboard/panels'

const KEY = 'kommands.dashboard-layout'

beforeEach(() => {
  window.localStorage.clear()
  useDashboardStore.setState({ placed: DEFAULT_PLACED, removed: [], hydrated: false })
})

test('with nothing stored, every panel is placed', () => {
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().placed).toEqual([...DEFAULT_PLACED])
  expect(useDashboardStore.getState().removed).toEqual([])
})

test('removing a panel survives a reload', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().remove('recent')

  useDashboardStore.setState({ placed: [], removed: [], hydrated: false })
  useDashboardStore.getState().hydrate()

  expect(useDashboardStore.getState().placed).not.toContain('recent')
  expect(useDashboardStore.getState().removed).toContain('recent')
})

test('restoring puts it back, and that survives too', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().remove('quick')
  useDashboardStore.getState().restore('quick')

  useDashboardStore.setState({ placed: [], removed: [], hydrated: false })
  useDashboardStore.getState().hydrate()

  expect(useDashboardStore.getState().placed).toContain('quick')
  expect(useDashboardStore.getState().removed).not.toContain('quick')
})

test('a panel this build has never heard of is dropped, not a reason to discard the rest', () => {
  // The same skip-the-entry-not-the-file rule the saved-command reader follows, applied
  // to the second persisted thing in the app. A stored layout naming a panel that was
  // renamed or removed in a later build must not cost the user the arrangement of the
  // panels that do still exist.
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, placed: ['quick', 'from-the-future'], removed: ['saved'] }),
  )
  useDashboardStore.getState().hydrate()

  expect(useDashboardStore.getState().placed).not.toContain('from-the-future')
  expect(useDashboardStore.getState().placed).toContain('quick')
  expect(useDashboardStore.getState().removed).toContain('saved')
})

test('a panel in neither list is new to this user, and appears', () => {
  // The rule that is easy to get wrong and expensive when it is. A stored list records
  // decisions taken, not an allowlist — so a panel added in a later build has to show
  // up for people who already have a stored layout, or it is invisible to them forever.
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, placed: ['saved'], removed: ['recent'] }),
  )
  useDashboardStore.getState().hydrate()

  expect(useDashboardStore.getState().placed).toContain('quick')
  expect(useDashboardStore.getState().removed).toEqual(['recent'])
})

test('a removed panel stays removed rather than being re-added as new', () => {
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, placed: ['saved', 'quick'], removed: ['recent'] }),
  )
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().placed).not.toContain('recent')
})

test('unreadable stored state falls back to the defaults rather than throwing', () => {
  window.localStorage.setItem(KEY, '{ not json')
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().placed).toEqual([...DEFAULT_PLACED])
})

test('hydrating twice does not re-read', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().remove('saved')
  // A second hydrate must not undo a change made since the first — it is a
  // once-per-session read, not a refresh.
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().placed).not.toContain('saved')
})
