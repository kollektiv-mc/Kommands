import { beforeEach, expect, test } from 'vitest'
import { useDashboardStore } from './useDashboardStore'
import { DEFAULT_PLACED } from '../components/dashboard/panels'

const KEY = 'kommands.dashboard-layout'

beforeEach(() => {
  window.localStorage.clear()
  useDashboardStore.setState({
    placed: DEFAULT_PLACED,
    removed: [],
    collapsed: [],
    hydrated: false,
  })
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

test('a closed panel is still a placed panel, and stays closed across a reload', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().toggleCollapsed('recent')

  useDashboardStore.setState({ placed: [], removed: [], collapsed: [], hydrated: false })
  useDashboardStore.getState().hydrate()

  // Closed and placed are orthogonal. Folding the flag into `placed` would make a
  // closed panel indistinguishable from a removed one, which is the distinction the
  // header's chevron and its cross are there to keep apart.
  expect(useDashboardStore.getState().placed).toContain('recent')
  expect(useDashboardStore.getState().collapsed).toEqual(['recent'])
})

test('removing a closed panel forgets that it was closed', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().toggleCollapsed('quick')
  useDashboardStore.getState().remove('quick')
  useDashboardStore.getState().restore('quick')

  // A restore is someone asking to see the panel again. Bringing it back shut would
  // look like the restore having failed, and nothing in the Add panel menu warns that
  // it might.
  expect(useDashboardStore.getState().collapsed).toEqual([])
})

test('a layout written before panels could close reads as nothing closed', () => {
  // The forward-compatibility rule this repo applies to every reader: a file missing a
  // field this build knows about is an older file, not a malformed one, and must not
  // cost the user the arrangement they did express.
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, placed: ['saved', 'recent'], removed: ['quick'] }),
  )
  useDashboardStore.getState().hydrate()

  expect(useDashboardStore.getState().collapsed).toEqual([])
  expect(useDashboardStore.getState().removed).toEqual(['quick'])
})

test('a closed flag on a panel that is not placed is dropped', () => {
  // Same skip-the-entry rule as an unknown id. A flag on a removed panel describes
  // nothing any reader can act on, and keeping it lets the list accumulate entries
  // that outlive every panel they name.
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      placed: ['saved'],
      removed: ['quick'],
      collapsed: ['quick', 'saved', 'nonsense'],
    }),
  )
  useDashboardStore.getState().hydrate()

  expect(useDashboardStore.getState().collapsed).toEqual(['saved'])
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
