import { beforeEach, describe, expect, test } from 'vitest'
import { TEMPLATES } from '../data/authored/generate'
import { group, modifier, shape } from '../worldedit/stack/make'
import { useShapeEditorStore } from './useShapeEditorStore'

const store = () => useShapeEditorStore.getState()
const names = () => store().layers.map((l) => l.name)

beforeEach(() => store().load({ layers: [], pattern: 'stone', hollow: false }))

describe('the shape editor store', () => {
  test('a new layer is selected, and undo takes it away', () => {
    const sphere = shape('sphere')
    store().add(sphere)
    expect(store().selected).toBe(sphere.id)
    store().undo()
    expect(store().layers).toEqual([])
    store().redo()
    expect(names()).toEqual(['Sphere'])
  })

  test('undo keeps the selection while the layer is still there', () => {
    const a = shape('sphere', { name: 'A' })
    const b = shape('box', { name: 'B' })
    store().add(a)
    store().add(b)
    store().select(a.id)
    store().rename(a.id, 'A2')
    store().undo()
    store().undo()
    expect(names()).toEqual(['A'])
    expect(store().selected).toBe(a.id)
    store().undo()
    expect(store().selected).toBeNull()
  })

  test('a drag of one value is one undo step', () => {
    const a = shape('sphere')
    store().add(a)
    for (const x of [0.1, 0.2, 0.3]) {
      store().change(a.id, (l) => ({ ...l, pos: [x, 0, 0] }), `${a.id}:pos`)
    }
    store().undo()
    expect(store().layers[0]?.pos).toEqual([0, 0, 0])
  })

  test('opening a group is not an undo step', () => {
    const g = group([shape('box')])
    store().add(g)
    store().toggleOpen(g.id)
    store().undo()
    expect(store().layers).toEqual([])
  })

  test('the op cycles Add, Cut, Overlap', () => {
    const a = shape('sphere')
    store().add(a)
    const ops = [1, 2, 3].map(() => {
      store().cycleOp(a.id)
      const l = store().layers[0]
      return l?.type === 'shape' ? l.op : null
    })
    expect(ops).toEqual(['cut', 'overlap', 'add'])
  })

  test('a template lands as one group named after it', () => {
    store().applyTemplate(TEMPLATES[0]!)
    expect(names()).toEqual(['Ringed planet'])
    expect(store().layers[0]?.type).toBe('group')
  })

  test('selecting outside the isolated layer ends isolation', () => {
    const a = shape('sphere')
    const m = modifier('mirror')
    const b = shape('box')
    store().load({ layers: [a, m, b], pattern: 'stone', hollow: false })
    store().setIsolate(m.id)
    store().select(b.id)
    expect(store().isolate).toBe(m.id)
    store().select(a.id)
    expect(store().isolate).toBeNull()
  })

  test('removing the selected layer clears the selection', () => {
    const a = shape('sphere')
    store().add(a)
    store().removeLayer(a.id)
    expect(store().selected).toBeNull()
  })
})
