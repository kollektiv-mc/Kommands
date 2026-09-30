import { expect, test } from 'vitest'
import { hasArgumentType, lookupArgumentType } from './index'
import { unimplementedDeepParsers, PARSERS } from '../../data/authored/parsers'
import type { SerializeContext } from '../../data/versions/types'

const ctx: SerializeContext = {
  traits: {} as SerializeContext['traits'],
  registries: {
    entries: (registry) => (registry === 'mob_effect' ? ['speed', 'regeneration'] : []),
    has: (registry, id) => registry === 'mob_effect' && ['speed', 'regeneration'].includes(id),
  },
}

const check = (key: string, value: unknown, options = {}) =>
  lookupArgumentType(key)
    .validate(value, options, ctx)
    .map((d) => d.message)

test('every shallow parser has an editor of its own rather than the text fallback', () => {
  // What stays text: the slots, whose sets are built from colours and container sizes
  // rather than listed, and objective criteria, which join a stat type to a registry
  // id. Each is a set to author, not a field that will do.
  const unhandled = Object.values(PARSERS)
    .filter((b) => b.kind === 'shallow' && !hasArgumentType(b.type))
    .map((b) => b.type)
  expect([...new Set(unhandled)].sort()).toEqual([
    'item_slot',
    'item_slots',
    'objective_criteria',
    'scoreboard_slot',
  ])
  // And the deep gap is unchanged by this: these are scalars.
  expect(unimplementedDeepParsers(hasArgumentType).length).toBeGreaterThan(0)
})

test('a registry-backed id warns when its registry does not hold it', () => {
  const options = { registry: 'minecraft:mob_effect' }
  expect(check('resource_location', 'speed', options)).toEqual([])
  expect(check('resource_location', 'minecraft:speed', options)).toEqual([])
  expect(check('resource_location', 'sped', options)).toEqual([
    'Not a known mob effect in this version',
  ])
  // A datapack's own namespace, or a tag, is not the vanilla registry's to judge.
  expect(check('resource_location', 'mypack:glow', options)).toEqual([])
  // With no registry named there is nothing to check against.
  expect(check('resource_location', 'anything')).toEqual([])
})

test('a closed set warns on a word outside it, and an optional one may be left out', () => {
  expect(check('gamemode', 'creative')).toEqual([])
  expect(check('gamemode', '')).toEqual([])
  expect(check('gamemode', 'hardcore')).toEqual([
    'Not one of survival, creative, adventure, spectator',
  ])
})

test('time and ranges explain their syntax when it is not met', () => {
  for (const ok of ['20', '1.5s', '3d', '100t']) expect(check('time', ok)).toEqual([])
  expect(check('time', '5m')).toEqual(['A number, then d, s or t (ticks if none)'])
  for (const ok of ['5', '-5', '0..5', '..100', '-100..'])
    expect(check('int_range', ok)).toEqual([])
  expect(check('int_range', '..')).toEqual(['A whole number or a range: 1..5, ..5, 1..'])
})
