import { beforeEach, expect, test } from 'vitest'
import { usePinnedGeneratorsStore } from './usePinnedGeneratorsStore'

const GIVE = { id: 'vanilla:give', label: '/give' }
const GENERATE = { id: 'worldedit:generate', label: '//generate' }

beforeEach(() => {
  window.localStorage.clear()
  usePinnedGeneratorsStore.setState({ pinned: [], hydrated: false })
})

test('pinning is a toggle, and survives a reload', () => {
  usePinnedGeneratorsStore.getState().toggle(GIVE)
  expect(usePinnedGeneratorsStore.getState().isPinned('vanilla:give')).toBe(true)

  // Written through immediately rather than on unmount: a pin is a decision, and a tab
  // closed between the click and a flush would lose it.
  usePinnedGeneratorsStore.setState({ pinned: [], hydrated: false })
  usePinnedGeneratorsStore.getState().hydrate()
  expect(usePinnedGeneratorsStore.getState().pinned).toEqual([GIVE])

  usePinnedGeneratorsStore.getState().toggle(GIVE)
  expect(usePinnedGeneratorsStore.getState().pinned).toEqual([])
})

test('the order is the order they were pinned in', () => {
  // Not alphabetised. The list is one the user built, and sorting it would be a second
  // opinion about their own shortlist.
  usePinnedGeneratorsStore.getState().toggle(GENERATE)
  usePinnedGeneratorsStore.getState().toggle(GIVE)
  expect(usePinnedGeneratorsStore.getState().pinned.map((p) => p.id)).toEqual([
    'worldedit:generate',
    'vanilla:give',
  ])
})

test('hydrate is idempotent, because two components call it', () => {
  // The dashboard calls it on mount and so does the command navbar, because the editor
  // is reachable by URL without the dashboard ever having rendered. Only the first
  // call may do work, or the second would discard pins made since.
  usePinnedGeneratorsStore.getState().toggle(GIVE)
  usePinnedGeneratorsStore.getState().hydrate()
  expect(usePinnedGeneratorsStore.getState().pinned).toEqual([GIVE])
})

test('a malformed entry drops itself rather than the whole list', () => {
  // The same skip-the-entry-not-the-file rule the saved-command reader follows. A
  // shortlist is cheap to rebuild and annoying to lose wholesale.
  window.localStorage.setItem(
    'kommands.pinned-generators',
    JSON.stringify([GIVE, { id: 'no-label' }, null, GENERATE]),
  )
  usePinnedGeneratorsStore.getState().hydrate()
  expect(usePinnedGeneratorsStore.getState().pinned).toEqual([GIVE, GENERATE])
})

test('unreadable storage is empty, not an error', () => {
  window.localStorage.setItem('kommands.pinned-generators', 'not json')
  usePinnedGeneratorsStore.getState().hydrate()
  expect(usePinnedGeneratorsStore.getState().pinned).toEqual([])
})
