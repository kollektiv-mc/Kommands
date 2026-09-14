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

describe('undo and redo', () => {
  test('step an argument back and forward again', () => {
    store().setArg('/0', 'first')
    store().setFlag('/f', true)

    store().undo()
    expect(store().value.flags['/f']).toBeUndefined()
    expect(store().value.args['/0']).toBe('first')

    store().redo()
    expect(store().value.flags['/f']).toBe(true)
  })

  test('a burst of typing in one field is one step', () => {
    store().setArg('/0', 'n')
    store().setArg('/0', 'ne')
    store().setArg('/0', 'net')

    store().undo()
    // Back to before the word, not one character into it. Tagging by path is what
    // collapses the burst; without it undo would be a backspace with extra steps.
    expect(store().value.args['/0']).toBeUndefined()
  })

  test('typing in a second field is its own step', () => {
    store().setArg('/0', 'a')
    store().setArg('/1', 'b')

    store().undo()
    expect(store().value.args['/1']).toBeUndefined()
    expect(store().value.args['/0']).toBe('a')
  })

  test('undoing a removed clause brings its values back with it', () => {
    const ids = addThree()
    store().setArg(`${instance(REPEAT, ids[1]!)}/0`, 'kept')

    store().reorderRepeat(REPEAT, [ids[0]!, ids[2]!])
    expect(store().value.args[`${instance(REPEAT, ids[1]!)}/0`]).toBeUndefined()

    store().undo()
    // The snapshot is taken before the subtree is cleared, so the clause comes back
    // filled in rather than empty. Restoring an emptied clause would look like the
    // undo worked while quietly costing the user the values.
    expect(store().value.repeats[REPEAT]).toEqual(ids)
    expect(store().value.args[`${instance(REPEAT, ids[1]!)}/0`]).toBe('kept')
  })

  test('a refused add leaves no step behind', () => {
    const capped = { max: 1 }
    store().addInstance(REPEAT, capped)
    store().addInstance(REPEAT, capped)

    store().undo()
    // One add happened, so one undo returns the Repeat to untouched. If the refused
    // add had recorded, this undo would have spent itself doing nothing and the user
    // would press it twice to see one change.
    //
    // Untouched is *absent*, not an empty list, and the two are not the same thing:
    // `repeatInstances` seeds an absent Repeat from `min`. Asserting `[]` here would
    // pass only for a Repeat that had been emptied by hand.
    expect(store().value.repeats[REPEAT]).toBeUndefined()
  })

  test('re-picking the same ref leaves no step behind', () => {
    store().setRef('/r', 'vanilla:give')
    store().setRef('/r', 'vanilla:give')

    store().undo()
    expect(store().value.refs['/r']).toBeUndefined()
  })

  test('does not rewind the instance counter, so an id is never handed out twice', () => {
    store().addInstance(REPEAT, node)
    const first = store().value.repeats[REPEAT]![0]!

    store().undo()
    store().addInstance(REPEAT, node)
    const second = store().value.repeats[REPEAT]![0]!

    // Burning an id on an undone clause costs nothing. Reusing one would put two
    // instances on one path, which is the failure the generated-id model exists to
    // prevent, arriving by a route nothing checks.
    expect(second).not.toBe(first)
  })

  test('a drag is one step, however many positions it crosses', () => {
    const ids = addThree()

    // What a pointer crossing two card midpoints produces: one gesture, three
    // orderings, all carrying the tag the chain minted when the drag began.
    store().reorderRepeat(REPEAT, [ids[1]!, ids[0]!, ids[2]!], '/1:drag:1')
    store().reorderRepeat(REPEAT, [ids[1]!, ids[2]!, ids[0]!], '/1:drag:1')

    store().undo()
    expect(store().value.repeats[REPEAT]).toEqual(ids)
  })

  test('two drags in a row are two steps', () => {
    const ids = addThree()

    // The tag is minted per gesture rather than derived from the dragged clause, so
    // dragging the same one twice does not collapse into a single step.
    store().reorderRepeat(REPEAT, [ids[1]!, ids[0]!, ids[2]!], '/1:drag:1')
    store().reorderRepeat(REPEAT, [ids[1]!, ids[2]!, ids[0]!], '/1:drag:2')

    store().undo()
    expect(store().value.repeats[REPEAT]).toEqual([ids[1]!, ids[0]!, ids[2]!])
  })

  test('an untagged reorder is its own step, which is what a click is', () => {
    const ids = addThree()

    store().reorderRepeat(REPEAT, [ids[1]!, ids[0]!, ids[2]!])
    store().reorderRepeat(REPEAT, [ids[1]!, ids[2]!, ids[0]!])

    store().undo()
    expect(store().value.repeats[REPEAT]).toEqual([ids[1]!, ids[0]!, ids[2]!])
  })

  test('stepping back past the start does nothing rather than throwing', () => {
    store().setArg('/0', 'only')
    store().undo()
    store().undo()
    expect(store().value.args['/0']).toBeUndefined()
  })

  test('a new edit after an undo discards the redo stack', () => {
    store().setArg('/0', 'a')
    store().setFlag('/f', true)
    store().undo()

    store().setArg('/2', 'diverged')
    store().redo()
    // Redo would have restored a tree that no longer follows from what is on screen.
    expect(store().value.flags['/f']).toBeUndefined()
    expect(store().value.args['/2']).toBe('diverged')
  })

  test('loading a saved tree clears the history', () => {
    store().setArg('/0', 'before')
    store().load({ args: {}, flags: {}, choices: {}, repeats: {}, refs: {} })

    store().undo()
    // A step back into the previous command's tree would be a step into paths this
    // definition does not have.
    expect(store().value.args['/0']).toBeUndefined()
  })
})
