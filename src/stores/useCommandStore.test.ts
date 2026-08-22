import { beforeEach, describe, expect, test } from 'vitest'
import { instance } from '../schema/paths'
import { useCommandStore } from './useCommandStore'

/**
 * Where instance identity is created and rearranged.
 *
 * These assertions used to live on `reindexInstances` in `paths.test.ts`, because under
 * the ordinal model reordering *was* a rewrite of every key beneath the Repeat. The
 * function is gone and the properties it protected are not, so they moved here — to the
 * only place that now changes what a clause is.
 */

const REPEAT = '/1'
const node = {}
const store = () => useCommandStore.getState()

beforeEach(() => store().reset())

const addThree = (): string[] => {
  for (let i = 0; i < 3; i++) store().addInstance(REPEAT, node)
  return [...(store().value.repeats[REPEAT] ?? [])]
}

describe('adding an instance', () => {
  test('each one gets an id nothing else has', () => {
    const ids = addThree()
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
  })

  test('ids are deterministic per store, so a failing assertion is readable', () => {
    const first = addThree()
    store().reset()
    expect(addThree()).toEqual(first)
  })

  test('a removed id is never handed out again', () => {
    // Reuse would silently graft a removed clause's values onto a new one, which is the
    // orphaned-values bug wearing a different hat.
    const [a, b, c] = addThree()
    store().setArg(`${instance(REPEAT, b!)}/0`, 'second')
    store().reorderRepeat(REPEAT, [a!, c!])
    store().addInstance(REPEAT, node)
    const ids = store().value.repeats[REPEAT] ?? []
    expect(ids).not.toContain(b)
    expect(store().value.args[`${instance(REPEAT, ids[2]!)}/0`]).toBeUndefined()
  })
})

describe('max is enforced where the instance is created', () => {
  test('a Repeat declared max: 3 does not accept a fourth', () => {
    // Declared in the type and in command-schema.md, and read by nothing until now: the
    // add button was gated on nothing and the store did not clamp (part of #30).
    for (let i = 0; i < 5; i++) store().addInstance(REPEAT, { max: 3 })
    expect(store().value.repeats[REPEAT]).toHaveLength(3)
  })

  test('a Repeat with no max is unbounded, as before', () => {
    for (let i = 0; i < 5; i++) store().addInstance(REPEAT, node)
    expect(store().value.repeats[REPEAT]).toHaveLength(5)
  })
})

describe('reordering moves clauses without moving values', () => {
  test('a swap carries each clause’s values with it', () => {
    const [a, b, c] = addThree()
    store().setArg(`${instance(REPEAT, a!)}/0`, 'first')
    store().setArg(`${instance(REPEAT, b!)}/0`, 'second')
    store().reorderRepeat(REPEAT, [b!, a!, c!])

    expect(store().value.repeats[REPEAT]).toEqual([b, a, c])
    // The point: the keys did not change. Under the ordinal model both of these values
    // had to be rewritten to land in the right clause.
    expect(store().value.args[`${instance(REPEAT, a!)}/0`]).toBe('first')
    expect(store().value.args[`${instance(REPEAT, b!)}/0`]).toBe('second')
  })

  test('keys outside the repeat are left alone', () => {
    const ids = addThree()
    store().setArg('/9', 'untouched')
    store().reorderRepeat(REPEAT, [...ids].reverse())
    expect(store().value.args['/9']).toBe('untouched')
  })

  test('a dropped clause takes its values with it rather than orphaning them', () => {
    // The bug the old remap existed to prevent: removing a clause used to leave its
    // values under an index that came back when the next clause was added — filled in,
    // in a clause the user never touched.
    const [a, b, c] = addThree()
    store().setArg(`${instance(REPEAT, a!)}/0`, 'first')
    store().setArg(`${instance(REPEAT, b!)}/0`, 'second')
    store().reorderRepeat(REPEAT, [b!, c!])

    expect(Object.values(store().value.args)).toEqual(['second'])
  })

  test('everything nested below a dropped clause goes too', () => {
    const [a] = addThree()
    const deep = `${instance(REPEAT, a!)}/|2/3`
    store().setArg(deep, 'deep')
    store().setChoice(`${instance(REPEAT, a!)}`, 1)
    store().setFlag(`${instance(REPEAT, a!)}/-h`, true)
    store().reorderRepeat(REPEAT, [])

    expect(store().value.args[deep]).toBeUndefined()
    expect(Object.keys(store().value.choices)).toEqual([])
    expect(Object.keys(store().value.flags)).toEqual([])
  })

  test('a clause that survives keeps nested values wholesale', () => {
    const [a, b] = addThree()
    const deep = `${instance(REPEAT, b!)}/|2/3`
    store().setArg(deep, 'deep')
    store().reorderRepeat(REPEAT, [b!, a!])
    expect(store().value.args[deep]).toBe('deep')
  })
})
