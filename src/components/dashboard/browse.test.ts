import { expect, test } from 'vitest'
import type { SavedCommand } from '../../schema/saved'
import { UNGROUPED, allTags, knownGroups, matches, sections } from './browse'

function command(over: Partial<SavedCommand>): SavedCommand {
  return {
    id: 'id',
    name: 'name',
    definitionId: 'vanilla:give',
    version: '1.21.1',
    value: { args: {}, flags: {}, choices: {}, repeats: {}, refs: {} },
    preview: '/give',
    revision: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const SWORD = command({ id: 's', name: 'Starter sword', group: 'Kits', tags: ['pvp'] })
const DAY = command({
  id: 'd',
  name: 'Day',
  definitionId: 'vanilla:time',
  preview: '/time set day',
})
const RESTART = command({
  id: 'r',
  name: 'Restart warning',
  definitionId: 'vanilla:tellraw',
  group: 'Messages',
  tags: ['admin', 'pvp-arena'],
})

test('search matches name, command, generator, group and tags', () => {
  expect(matches(SWORD, 'starter', [])).toBe(true)
  expect(matches(DAY, 'time set', [])).toBe(true)
  expect(matches(RESTART, 'tellraw', [])).toBe(true)
  expect(matches(SWORD, 'kits', [])).toBe(true)
  expect(matches(DAY, 'ungrouped', [])).toBe(true)
  expect(matches(SWORD, 'nether', [])).toBe(false)
})

test('a hash word searches tags only, and picked tags must all be present', () => {
  expect(matches(RESTART, '#pvp', [])).toBe(true)
  expect(matches(RESTART, '#restart', [])).toBe(false)
  expect(matches(SWORD, '', ['pvp'])).toBe(true)
  expect(matches(SWORD, '', ['pvp', 'admin'])).toBe(false)
})

test('by group, empty groups stay as drop targets until a search hides them', () => {
  const all = [SWORD, DAY, RESTART]
  const shown = sections(all, 'group', ['Builds'], false)
  expect(shown.map((s) => s.heading)).toEqual(['Builds', 'Kits', 'Messages', UNGROUPED])
  expect(sections([SWORD], 'group', ['Builds'], true).map((s) => s.heading)).toEqual(['Kits'])
})

test('by generator and as a list', () => {
  const all = [SWORD, DAY, RESTART]
  expect(sections(all, 'generator', [], false).map((s) => s.heading)).toEqual([
    'vanilla:give',
    'vanilla:tellraw',
    'vanilla:time',
  ])
  expect(sections(all, 'list', [], false)).toEqual([{ heading: null, commands: all }])
})

test('groups and tags in use are collected once each', () => {
  expect(knownGroups([SWORD, RESTART], ['Messages', 'Builds'])).toEqual([
    'Messages',
    'Builds',
    'Kits',
  ])
  expect(allTags([SWORD, DAY, RESTART])).toEqual(['admin', 'pvp', 'pvp-arena'])
})
