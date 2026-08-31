import { expect, test } from 'vitest'
import { PANELS, panelById } from './panels'
import type { SavedCommand } from '../../schema/saved'

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

const A = command({ id: 'a', name: 'A' })
const B = command({ id: 'b', name: 'B', lastOpenedAt: '2026-01-02T00:00:00.000Z' })
const C = command({ id: 'c', name: 'C', lastOpenedAt: '2026-01-03T00:00:00.000Z', pinned: true })
const ALL = [A, B, C]

test('Saved shows everything, in the order the store handed it over', () => {
  // Identity, deliberately. The store already sorts newest-updatedAt first with an id
  // tiebreak; re-sorting here would be a second opinion on a settled question.
  expect(panelById('saved')!.select(ALL)).toEqual(ALL)
})

test('Recent shows only what has actually been opened, newest first', () => {
  // The filter is the whole panel. Without it Recent is Saved again in a different
  // order, and a command you have never opened claims to be one you just did.
  expect(
    panelById('recent')!
      .select(ALL)
      .map((c) => c.id),
  ).toEqual(['c', 'b'])
})

test('Quick shows only pinned commands', () => {
  expect(
    panelById('quick')!
      .select(ALL)
      .map((c) => c.id),
  ).toEqual(['c'])
})

test('a command can appear in more than one panel at once', () => {
  // These are lenses, not folders. C is saved, recently opened and pinned, so it shows
  // in all three — which is correct, and is why there is one store rather than three.
  const appearances = PANELS.filter((panel) => panel.select(ALL).some((c) => c.id === 'c'))
  expect(appearances.map((p) => p.id)).toEqual(['saved', 'recent', 'quick'])
})

test('every panel says something when it is empty', () => {
  // A panel that renders as a blank box reads as broken rather than as empty.
  for (const panel of PANELS) {
    expect(panel.select([])).toEqual([])
    expect(panel.empty.length).toBeGreaterThan(0)
  }
})
