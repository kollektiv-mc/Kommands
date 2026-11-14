import { describe, expect, test } from 'vitest'
import { stackCommand } from '../../worldedit/stack/command'
import { shape } from '../../worldedit/stack/make'
import { doneValues, openSnapshot } from './binding'

/** The sheet's values in, the editor's document out, and back. */
describe('opening the editor on the sheet', () => {
  test('a typed expression becomes one Formula layer', () => {
    const snapshot = openSnapshot({ expression: ' y<0 ', pattern: { entries: [] }, '-h': true })
    expect(snapshot.layers).toHaveLength(1)
    expect(snapshot.layers[0]).toMatchObject({ kind: 'formula', params: { source: 'y<0' } })
    expect([snapshot.pattern, snapshot.hollow, snapshot.round]).toEqual(['', true, false])
  })

  test('nothing typed opens an empty stack', () => {
    expect(openSnapshot({}).layers).toEqual([])
  })

  test('layers it cannot read open as their text', () => {
    const snapshot = openSnapshot({ expression: { source: 'x<0', layers: { version: 9 } } })
    expect(snapshot.layers[0]).toMatchObject({ kind: 'formula', params: { source: 'x<0' } })
  })
})

describe('Done and opening again', () => {
  test('give back the same document', () => {
    const layers = [shape('sphere'), shape('box', { op: 'cut' })]
    const snapshot = { layers, pattern: '50%stone,dirt', hollow: true, round: true }
    const values = doneValues(snapshot, stackCommand(snapshot))
    expect(values['-h']).toBe(true)
    expect(values['pattern']).toEqual({
      entries: [
        { block: 'stone', weight: 50 },
        { block: 'dirt', weight: '' },
      ],
    })
    expect(openSnapshot(values)).toEqual(snapshot)
  })

  test('an empty Blocks field writes the block the command used', () => {
    const snapshot = { layers: [shape('sphere')], pattern: ' ', hollow: false, round: false }
    const values = doneValues(snapshot, stackCommand(snapshot))
    expect(values['pattern']).toEqual({ entries: [{ block: 'stone', weight: '' }] })
  })

  test('an empty stack writes no expression', () => {
    const snapshot = { layers: [], pattern: 'stone', hollow: false, round: false }
    expect(doneValues(snapshot, stackCommand(snapshot))['expression']).toBe('')
  })
})
