import { expect, test } from 'vitest'
import {
  PANELS,
  SLOTS_PER_ROW,
  emptySlots,
  panelById,
  type CommandPanel,
  type PanelId,
} from './panels'
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

/**
 * A panel that is a lens over the saved commands, or a failure naming the one that is
 * not. `Pinned generators` reads a different collection and has no `select` — asking
 * for one by id is a test bug rather than a runtime case, so it says so here rather
 * than being silently skipped by a filter.
 */
function lens(id: PanelId): CommandPanel {
  const panel = panelById(id)
  if (panel?.source !== 'commands') throw new Error(`${id} is not a lens over commands`)
  return panel
}

/** Every panel that is such a lens. */
const LENSES = PANELS.filter((panel): panel is CommandPanel => panel.source === 'commands')

test('Saved shows everything, in the order the store handed it over', () => {
  // Identity, deliberately. The store already sorts newest-updatedAt first with an id
  // tiebreak; re-sorting here would be a second opinion on a settled question.
  expect(lens('saved').select(ALL)).toEqual(ALL)
})

test('Recent shows only what has actually been opened, newest first', () => {
  // The filter is the whole panel. Without it Recent is Saved again in a different
  // order, and a command you have never opened claims to be one you just did.
  expect(
    lens('recent')
      .select(ALL)
      .map((c) => c.id),
  ).toEqual(['c', 'b'])
})

test('Quick shows only pinned commands', () => {
  expect(
    lens('quick')
      .select(ALL)
      .map((c) => c.id),
  ).toEqual(['c'])
})

test('a command can appear in more than one panel at once', () => {
  // These are lenses, not folders. C is saved, recently opened and pinned, so it shows
  // in all three — which is correct, and is why there is one store rather than three.
  const appearances = LENSES.filter((panel) => panel.select(ALL).some((c) => c.id === 'c'))
  expect(appearances.map((p) => p.id)).toEqual(['saved', 'recent', 'quick'])
})

test('every panel says something when it is empty', () => {
  // A panel that renders as a blank box reads as broken rather than as empty. Asserted
  // over PANELS rather than LENSES: the sentence is the part every panel owes,
  // whichever collection it reads.
  for (const panel of PANELS) {
    expect(panel.empty.length).toBeGreaterThan(0)
  }
  for (const panel of LENSES) {
    expect(panel.select([])).toEqual([])
  }
})

test('an empty panel offers a whole row of space, and a full row offers none', () => {
  // The affordance is "there is room here", not "this panel is broken". Six outlines
  // say the first; a bare sentence says neither.
  expect(emptySlots(0)).toBe(6)
  expect(emptySlots(4)).toBe(2)
  expect(emptySlots(6)).toBe(0)
  // And it finishes the row rather than padding to some fixed height — seven tiles get
  // five slots, not forty-one.
  expect(emptySlots(7)).toBe(5)
  expect(emptySlots(12)).toBe(0)
  // Six is chosen for its factors: a full row stays a whole number of full rows at
  // every narrower breakpoint the grid steps through. Four is the one the ramp skips,
  // and this is why.
  for (const columns of [1, 2, 3, 6]) expect(SLOTS_PER_ROW % columns).toBe(0)
})

test('the pinned-generators panel is not a lens over saved commands', () => {
  // The union in panels.ts is the point: a `select` that ignored its argument would be
  // a lie with a type signature, and this is the assertion that the shape stays honest.
  expect(panelById('pinned')?.source).toBe('generators')
  expect(LENSES.map((panel) => panel.id)).toEqual(['saved', 'recent', 'quick'])
})
