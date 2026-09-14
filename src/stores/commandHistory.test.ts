import { describe, expect, it } from 'vitest'
import { EMPTY_VALUE } from '../schema/serialize'
import type { CommandValue } from '../schema/serialize'
import { canRedo, canUndo, emptyHistory, MAX_HISTORY, record, redo, undo } from './commandHistory'

/** A tree distinguishable from every other by one argument. */
const tree = (marker: string): CommandValue => ({ ...EMPTY_VALUE, args: { '/0': marker } })

describe('record', () => {
  it('pushes the snapshot it is given', () => {
    const state = record(emptyHistory(), tree('a'))
    expect(state.past).toEqual([tree('a')])
  })

  it('collapses consecutive calls carrying the same tag', () => {
    let state = record(emptyHistory(), tree('a'), 'arg:/0')
    state = record(state, tree('ab'), 'arg:/0')
    state = record(state, tree('abc'), 'arg:/0')

    // One entry, and it is the *first* of the burst: undoing a burst of keystrokes
    // lands before the word rather than one character into it.
    expect(state.past).toEqual([tree('a')])
  })

  it('starts a new entry when the tag changes', () => {
    let state = record(emptyHistory(), tree('a'), 'arg:/0')
    state = record(state, tree('b'), 'arg:/1')
    expect(state.past).toEqual([tree('a'), tree('b')])
  })

  it('does not collapse an untagged call into the burst before it', () => {
    let state = record(emptyHistory(), tree('a'), 'arg:/0')
    state = record(state, tree('b'))
    expect(state.past).toEqual([tree('a'), tree('b')])
  })

  it('lets the same tag record again once a structural change has intervened', () => {
    let state = record(emptyHistory(), tree('a'), 'arg:/0')
    state = record(state, tree('b'))
    state = record(state, tree('c'), 'arg:/0')

    // Two visits to one field, with a structural change between them, are two steps.
    // This is what `lastTag` is for: without clearing it, the second visit would be
    // swallowed by the first.
    expect(state.past).toEqual([tree('a'), tree('b'), tree('c')])
  })

  it('clears the redo stack', () => {
    const stepped = undo(record(emptyHistory(), tree('a')), tree('b'))
    expect(stepped?.state.future).toHaveLength(1)
    expect(record(stepped!.state, tree('c')).future).toEqual([])
  })

  it('drops the oldest entry past the cap', () => {
    let state = emptyHistory()
    for (let i = 0; i <= MAX_HISTORY; i += 1) state = record(state, tree(`${i}`))

    expect(state.past).toHaveLength(MAX_HISTORY)
    expect(state.past[0]).toEqual(tree('1'))
  })
})

describe('undo and redo', () => {
  it('return null when there is nothing to step to', () => {
    expect(undo(emptyHistory(), tree('a'))).toBeNull()
    expect(redo(emptyHistory(), tree('a'))).toBeNull()
  })

  it('round-trip through the same trees', () => {
    const state = record(emptyHistory(), tree('a'))

    const back = undo(state, tree('b'))
    expect(back?.snapshot).toEqual(tree('a'))

    const forward = redo(back!.state, back!.snapshot)
    expect(forward?.snapshot).toEqual(tree('b'))
    expect(forward?.state.past).toEqual([tree('a')])
  })

  it('clear the tag, so a resumed burst is its own step', () => {
    let state = record(emptyHistory(), tree('a'), 'arg:/0')
    state = undo(state, tree('b'))!.state
    expect(state.lastTag).toBeNull()
  })

  it('report what they can do', () => {
    expect(canUndo(emptyHistory())).toBe(false)
    expect(canRedo(emptyHistory())).toBe(false)

    const state = record(emptyHistory(), tree('a'))
    expect(canUndo(state)).toBe(true)
    expect(canRedo(state)).toBe(false)

    const back = undo(state, tree('b'))!.state
    expect(canUndo(back)).toBe(false)
    expect(canRedo(back)).toBe(true)
  })

  it('walks back through a multi-step history in order', () => {
    let state = emptyHistory()
    state = record(state, tree('a'))
    state = record(state, tree('b'))
    state = record(state, tree('c'))

    const first = undo(state, tree('d'))!
    expect(first.snapshot).toEqual(tree('c'))
    const second = undo(first.state, first.snapshot)!
    expect(second.snapshot).toEqual(tree('b'))
    const third = undo(second.state, second.snapshot)!
    expect(third.snapshot).toEqual(tree('a'))
    expect(undo(third.state, third.snapshot)).toBeNull()
  })
})
