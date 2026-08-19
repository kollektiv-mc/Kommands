import { describe, expect, test } from 'vitest'
import { branch, child, choiceSelection, instance, NO_BRANCH, reindexInstances } from './paths'

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

describe('reindexInstances — moving a clause moves everything under it', () => {
  const table = {
    [`${instance('/1', 0)}/1`]: 'first',
    [`${instance('/1', 1)}/1`]: 'second',
    [`${instance('/1', 2)}/1`]: 'third',
    '/9': 'untouched',
  }

  test('a swap carries each clause’s values with it', () => {
    const moved = reindexInstances(table, '/1', [1, 0, 2])
    expect(moved[`${instance('/1', 0)}/1`]).toBe('second')
    expect(moved[`${instance('/1', 1)}/1`]).toBe('first')
    expect(moved[`${instance('/1', 2)}/1`]).toBe('third')
  })

  test('keys outside the repeat are left alone', () => {
    expect(reindexInstances(table, '/1', [0, 1, 2])['/9']).toBe('untouched')
  })

  test('a dropped clause takes its values with it rather than orphaning them', () => {
    // The bug this exists to prevent: removing the first clause used to drop the last
    // index and leave `#0`'s values in place, so they reappeared in the next clause
    // added — filled in, in a clause the user never touched.
    const removed = reindexInstances(table, '/1', [1, 2])
    expect(Object.values(removed).sort()).toEqual(['second', 'third', 'untouched'])
    expect(removed[`${instance('/1', 0)}/1`]).toBe('second')
    expect(removed[`${instance('/1', 1)}/1`]).toBe('third')
  })

  test('a two-digit index is not folded into a one-digit one', () => {
    // `#1` is a prefix of `#10`, so a naive slice would move the eleventh clause's
    // values into the second.
    const many = { [`${instance('/1', 1)}/0`]: 'one', [`${instance('/1', 10)}/0`]: 'ten' }
    const order = [...Array(11).keys()]
    const same = reindexInstances(many, '/1', order)
    expect(same[`${instance('/1', 1)}/0`]).toBe('one')
    expect(same[`${instance('/1', 10)}/0`]).toBe('ten')
  })

  test('nested paths below the instance are preserved wholesale', () => {
    const deep = { [`${instance('/1', 1)}${branch('', 2)}${child('', 3)}`]: 'deep' }
    const moved = reindexInstances(deep, '/1', [1, 0])
    expect(moved[`${instance('/1', 0)}${branch('', 2)}${child('', 3)}`]).toBe('deep')
  })
})
