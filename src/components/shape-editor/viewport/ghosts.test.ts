import { describe, expect, test } from 'vitest'
import { SHAPE_KINDS } from '../../../worldedit/stack/layers'
import { shape } from '../../../worldedit/stack/make'
import { ghostOf, ghostOpacity } from './ghosts'

describe('a shape drawn as its outline', () => {
  test('every kind but Half has one', () => {
    for (const kind of SHAPE_KINDS) expect(ghostOf(shape(kind)), kind).not.toBeNull()
    expect(ghostOf(shape('half'))).toBeNull()
  })

  test('a box is as big as its sides', () => {
    const ghost = ghostOf(shape('box', { params: { width: 0.4, height: 1, depth: 0.2 } }))!
    ghost.solid!.computeBoundingBox()
    const box = ghost.solid!.boundingBox!
    expect(box.max.x).toBeCloseTo(0.2)
    expect(box.max.y).toBeCloseTo(0.5)
    expect(box.max.z).toBeCloseTo(0.1)
  })

  test('a triangle points up y and is centred on its depth', () => {
    const ghost = ghostOf(shape('triangle', { params: { width: 1, height: 1, depth: 0.5 } }))!
    ghost.solid!.computeBoundingBox()
    const { min, max } = ghost.solid!.boundingBox!
    expect([min.z, max.z].map((v) => Math.round(v * 100))).toEqual([-25, 25])
    expect([min.y, max.y].map((v) => Math.round(v * 100))).toEqual([-50, 50])
  })

  test('a formula fills the selection, as its box', () => {
    const ghost = ghostOf(shape('formula'))!
    expect([ghost.field, ghost.solid]).toEqual([true, null])
  })
})

describe('how strongly an outline is drawn', () => {
  const sphere = shape('sphere')
  const ghost = ghostOf(sphere)!

  test('in Blocks an unselected Add is left to the blocks', () => {
    expect(ghostOpacity(sphere, ghost, { selected: false, shapes: false })).toEqual({
      solid: 0,
      lines: 0,
    })
  })

  test('a Cut shows in Blocks, and the selection most of all', () => {
    const cut = { ...sphere, op: 'cut' as const }
    expect(ghostOpacity(cut, ghost, { selected: false, shapes: false }).lines).toBeGreaterThan(0)
    const selected = ghostOpacity(sphere, ghost, { selected: true, shapes: false })
    const shapes = ghostOpacity(sphere, ghost, { selected: false, shapes: true })
    expect(selected.lines).toBeGreaterThan(shapes.lines)
    expect(shapes.solid).toBeGreaterThan(0)
  })
})
