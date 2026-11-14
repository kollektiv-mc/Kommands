import { describe, expect, test } from 'vitest'
import { TEMPLATES } from '../../data/authored/generate'
import { readDocument } from './document'
import { group, modifier, reference, shape } from './make'
import { templateLayers } from './templates'

/**
 * A saved document is read back exactly, or not at all.
 *
 * It arrives from a file, so each test below is a way a file can be wrong. The answer
 * to every one of them is null, which the editor turns into the command's text: never
 * a stack that is partly what was saved.
 */
const saved = (layers: unknown, extra: Record<string, unknown> = {}) =>
  JSON.parse(JSON.stringify({ version: 1, layers, ...extra })) as unknown

describe('a saved document', () => {
  test('every template survives a trip through JSON', () => {
    for (const template of TEMPLATES) {
      const layers = templateLayers(template)
      expect(readDocument(saved(layers)), template.id).toEqual({ version: 1, layers })
    }
  })

  test('each kind of layer is read, with Round numbers', () => {
    const layers = [
      modifier('bend', { params: { axis: 'y', toward: 'x', side: '+' } }),
      group([shape('half'), shape('formula', { params: { source: 'y<0' } })]),
      reference({ command: '//generate stone y<0' }),
    ]
    expect(readDocument(saved(layers, { round: true }))).toEqual({
      version: 1,
      layers,
      round: true,
    })
  })

  test('a field this build does not know is dropped', () => {
    const [sphere] = [shape('sphere')]
    const read = readDocument(saved([{ ...sphere, glow: 1, params: { radius: 1, hue: 2 } }]))
    expect(read?.layers).toEqual([{ ...sphere, params: { radius: 1 } }])
  })
})

describe('a document that does not fit is refused whole', () => {
  const sphere = shape('sphere')
  const cases: ReadonlyArray<readonly [string, unknown]> = [
    ['another version', { version: 2, layers: [] }],
    ['no list of layers', { version: 1, layers: {} }],
    ['an unknown kind', saved([{ ...sphere, kind: 'blob' }])],
    ['a missing param', saved([{ ...sphere, params: {} }])],
    ['a param of the wrong type', saved([{ ...sphere, params: { radius: '1' } }])],
    ['a word that is not one', saved([modifier('mirror', { params: { axis: 'w' as 'x' } })])],
    ['a position of two numbers', saved([{ ...sphere, pos: [0, 0] }])],
    ['an op that is not one', saved([{ ...sphere, op: 'xor' }])],
    ['two layers with one id', saved([sphere, sphere])],
    [
      'a bad layer deep in a group',
      saved([{ ...group([]), children: [{ ...sphere, visible: 'yes' }] }]),
    ],
    ['Round numbers that is not a switch', saved([], { round: 'yes' })],
  ]
  for (const [name, value] of cases) {
    test(name, () => expect(readDocument(value)).toBeNull())
  }

  test('a number that is not finite', () => {
    expect(readDocument({ version: 1, layers: [{ ...sphere, pos: [0, Infinity, 0] }] })).toBeNull()
  })
})
