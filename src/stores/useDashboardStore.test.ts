import { beforeEach, expect, test } from 'vitest'
import { useDashboardStore } from './useDashboardStore'

const KEY = 'kommands.dashboard-layout'

beforeEach(() => {
  window.localStorage.clear()
  useDashboardStore.setState({ collapsed: [], order: [], groups: [], hydrated: false })
})

const reload = () => {
  useDashboardStore.setState({ collapsed: [], order: [], groups: [], hydrated: false })
  useDashboardStore.getState().hydrate()
}

test('with nothing stored, nothing is closed', () => {
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().collapsed).toEqual([])
})

test('a closed panel stays closed across a reload', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().toggleCollapsed('recent')
  reload()
  expect(useDashboardStore.getState().collapsed).toEqual(['recent'])
})

test('a layout from when panels could be removed still loads', () => {
  // Version 1 carried `placed` and `removed`. Every panel is now always shown, so a
  // removed panel comes back, and what else the layout said still holds.
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      placed: ['saved'],
      removed: ['quick'],
      collapsed: ['recent'],
    }),
  )
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().collapsed).toEqual(['recent'])
})

test('a closed flag on an unknown panel is dropped, not the layout', () => {
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 2, collapsed: ['from-the-future', 'saved'], order: ['a'] }),
  )
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().collapsed).toEqual(['saved'])
  expect(useDashboardStore.getState().order).toEqual(['a'])
})

test('unreadable stored state falls back to the defaults', () => {
  window.localStorage.setItem(KEY, '{ not json')
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().collapsed).toEqual([])
})

test('hydrating twice does not re-read', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().toggleCollapsed('saved')
  // A once-per-session read, not a refresh: it must not undo a change made since.
  useDashboardStore.getState().hydrate()
  expect(useDashboardStore.getState().collapsed).toEqual(['saved'])
})

test('a dragged order and an added group survive a reload', () => {
  useDashboardStore.getState().hydrate()
  useDashboardStore.getState().reorder(['a', 'b', 'c'], 'c', 'a')
  useDashboardStore.getState().addGroup(' Kits ')
  useDashboardStore.getState().addGroup('Kits')
  useDashboardStore.getState().addGroup('  ')
  reload()
  expect(useDashboardStore.getState().order).toEqual(['c', 'a', 'b'])
  expect(useDashboardStore.getState().groups).toEqual(['Kits'])
})
