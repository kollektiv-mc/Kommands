import { describe, expect, test } from 'vitest'
import { choiceSelection, instance, NO_BRANCH, repeatInstances, seedInstances } from './paths'

describe('choiceSelection — what an absent selection means', () => {
  const required = { nodes: [0, 1, 2] }
  const optional = { nodes: [0, 1, 2], optional: true }

  test('a required Choice with nothing recorded applies its first branch', () => {
    expect(choiceSelection({}, '/1', required)).toBe(0)
  })

  test('an optional one applies none, which is where a fresh command starts', () => {
    expect(choiceSelection({}, '/1', optional)).toBe(NO_BRANCH)
  })

  test('an explicit selection wins for either', () => {
    expect(choiceSelection({ '/1': 2 }, '/1', required)).toBe(2)
    expect(choiceSelection({ '/1': 2 }, '/1', optional)).toBe(2)
  })

  test('an optional Choice can be put back to none once chosen', () => {
    expect(choiceSelection({ '/1': NO_BRANCH }, '/1', optional)).toBe(NO_BRANCH)
  })

  test('a required one cannot, because one branch must apply', () => {
    expect(choiceSelection({ '/1': NO_BRANCH }, '/1', required)).toBe(0)
  })

  test('a stale index out of range falls back rather than rendering nothing', () => {
    // Selections outlive the branch they pointed at: switching a Ref's target, or
    // regenerating a skeleton with fewer branches, both leave one behind.
    expect(choiceSelection({ '/1': 9 }, '/1', required)).toBe(0)
    expect(choiceSelection({ '/1': 9 }, '/1', optional)).toBe(NO_BRANCH)
  })
})

describe('repeatInstances — the id list is the clause order', () => {
  test('an untouched Repeat has as many instances as its min', () => {
    expect(repeatInstances({}, '/1', { min: 2 })).toHaveLength(2)
    expect(repeatInstances({}, '/1', {})).toEqual([])
  })

  test('seeded ids are stable, or an untouched Repeat would remount every render', () => {
    expect(repeatInstances({}, '/1', { min: 2 })).toEqual(repeatInstances({}, '/1', { min: 2 }))
  })

  test('seeded ids cannot collide with generated ones', () => {
    // Two clauses on one path is the exact failure the id model exists to prevent, and a
    // collision between a seed and a generated id would let it in by the back door.
    expect(seedInstances(3).every((id) => id.startsWith('seed:'))).toBe(true)
    expect(seedInstances(3)).not.toContain('i0')
  })

  test('a stored list wins over the seed, and keeps its order', () => {
    expect(repeatInstances({ '/1': ['i7', 'i2'] }, '/1', { min: 2 })).toEqual(['i7', 'i2'])
  })
})

describe('an instance path carries identity rather than position', () => {
  test('reordering the ids does not change any path', () => {
    // The property the whole change buys, stated once. Under the ordinal model every key
    // beneath a Repeat had to be rewritten on a reorder; here a clause's path is a fact
    // about which clause it is, so a permutation of the list moves nothing.
    const before = ['a', 'b', 'c'].map((id) => instance('/1', id))
    const after = ['c', 'a', 'b'].map((id) => instance('/1', id))
    expect(new Set(after)).toEqual(new Set(before))
  })

  test('an id is never parsed back out of a path', () => {
    // `#1` was a prefix of `#10`, so the old remap had to read the whole index or it
    // folded the eleventh clause into the second. Nothing reads an id out of a path now,
    // so that class of bug is gone rather than guarded — but ids must still not be
    // prefixes of one another *as paths*, which the separator guarantees.
    expect(instance('/1', 'i1')).not.toBe(instance('/1', 'i10'))
    expect(instance('/1', 'i10').startsWith(instance('/1', 'i1'))).toBe(true)
    expect(`${instance('/1', 'i10')}/`.startsWith(`${instance('/1', 'i1')}/`)).toBe(false)
  })
})
