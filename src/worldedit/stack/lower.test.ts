import { describe, expect, test } from 'vitest'
import { compileTree, simplify, treeProblems } from '../csg'
import { compileExpression } from '../expression'
import { BASE_SEED, seeded } from '../csg/arbitrary'
import { referenceFor } from '../csg/reference'
import { randomStack } from './arbitrary'
import type { Layer } from './layers'
import { lowerLayers } from './lower'
import { group, modifier, reference, shape } from './make'
import { insideStack } from './oracle'

const command = (layers: readonly Layer[]): string =>
  compileTree(simplify(lowerLayers(layers))).source

type Point = [number, number, number]

/**
 * Whether the oracle is sure about a point. The lowering rounds coefficients to twelve
 * digits and composes turns into one matrix, so a point within a hair of a face may
 * honestly fall either side of it; such a point proves nothing either way.
 */
function settled(layers: readonly Layer[], [x, y, z]: Point): boolean {
  const at = insideStack(layers, [x, y, z])
  const e = 1e-7
  const near: Point[] = [
    [x + e, y, z],
    [x - e, y, z],
    [x, y + e, z],
    [x, y - e, z],
    [x, y, z + e],
    [x, y, z - e],
  ]
  return near.every((p) => insideStack(layers, p) === at)
}

function disagreements(layers: readonly Layer[], random: () => number): string[] {
  const tree = lowerLayers(layers)
  const lowered = referenceFor(tree)
  const out: string[] = []
  for (let i = 0; i < 300; i++) {
    const p: Point = [random() * 2.4 - 1.2, random() * 2.4 - 1.2, random() * 2.4 - 1.2]
    const expected = insideStack(layers, p)
    if (lowered(...p) !== expected && settled(layers, p)) out.push(`(${p.join(', ')}) ${expected}`)
  }
  return out
}

describe('a lowered stack means what the layers say', () => {
  test('across the generated corpus', () => {
    for (let i = 0; i < 300; i++) {
      const random = seeded(BASE_SEED + i)
      const layers = randomStack(random)
      const tree = lowerLayers(layers)
      expect(treeProblems(tree), `seed ${BASE_SEED + i}`).toEqual([])
      expect(disagreements(layers, random), `seed ${BASE_SEED + i}`).toEqual([])
    }
  })

  test('and every command it writes parses', () => {
    for (let i = 0; i < 60; i++) {
      const source = command(randomStack(seeded(BASE_SEED + 1000 + i)))
      expect(compileExpression(source).ok, source).toBe(true)
    }
  })
})

describe('the list reads top to bottom', () => {
  test('a cut with nothing above it cuts nothing', () => {
    const layers = [
      shape('sphere', { op: 'cut' }),
      shape('box', { params: { width: 1, height: 1, depth: 1 } }),
    ]
    expect(command(layers)).toBe('abs(x)<0.5&&abs(y)<0.5&&abs(z)<0.5')
  })

  test('an empty stack is empty', () => {
    expect(command([])).toBe('0')
    expect(
      command([shape('sphere', { op: 'cut' }), reference({ command: '//generate stone 1' })]),
    ).toBe('0')
  })

  test('hidden layers and references are not in the command', () => {
    const hidden = { ...shape('box'), visible: false }
    expect(command([shape('sphere', { params: { radius: 1 } }), hidden, reference()])).toBe(
      'x^2+y^2+z^2<1',
    )
  })
})

describe('placement', () => {
  test('a uniform scale folds into the sphere', () => {
    expect(command([shape('sphere', { params: { radius: 0.25 }, scl: [2, 2, 2] })])).toBe(
      'x^2+y^2+z^2<0.25',
    )
  })

  test('a turned sphere is the same sphere', () => {
    expect(command([shape('sphere', { params: { radius: 1 }, rot: [30, 40, 50] })])).toBe(
      'x^2+y^2+z^2<1',
    )
  })

  test('a quarter turn writes no rounding noise', () => {
    const layers = [
      shape('box', { params: { width: 0.8, height: 0.4, depth: 1.6 }, rot: [90, 0, 90] }),
    ]
    const source = command(layers)
    expect(source).not.toMatch(/e-|\d{7}/)
  })

  test('a moved group keeps only its own box', () => {
    const layers = [
      group([shape('sphere', { params: { radius: 1.5 } })], {
        pos: [0.5, 0, 0],
        scl: [0.5, 0.5, 0.5],
      }),
    ]
    const inside = referenceFor(lowerLayers(layers))
    expect(inside(0.5, 0, 0)).toBe(true)
    // Inside the sphere, outside the group's box.
    expect(inside(0.5, 0.6, 0)).toBe(false)
  })
})

describe('modifiers act on what is below them', () => {
  test('and not on what is above', () => {
    const layers = [
      shape('sphere', { params: { radius: 0.2 }, pos: [0.5, 0, 0] }),
      modifier('mirror', { params: { axis: 'x', side: '-' } }),
      shape('sphere', { params: { radius: 0.2 }, pos: [0, 0.5, 0] }),
    ]
    const inside = referenceFor(lowerLayers(layers))
    expect(inside(0.5, 0, 0)).toBe(true)
    expect(inside(-0.5, 0, 0)).toBe(false)
  })

  test('an unturned modifier keeps only its pivot axes', () => {
    const layers = [
      modifier('mirror', { pos: [0.25, 0.5, 0.5], params: { axis: 'x' } }),
      shape('sphere', { params: { radius: 0.3 }, pos: [0.5, 0, 0] }),
    ]
    expect(command(layers)).toBe('(abs(x-0.25)-0.25)^2+y^2+z^2<0.09')
  })

  test('a modifier that does nothing is not in the command', () => {
    const sphere = shape('sphere', { params: { radius: 1 } })
    for (const idle of [
      modifier('array', { params: { count: 1 } }),
      modifier('radial', { params: { count: 1 } }),
      modifier('taper', { params: { amount: 0 } }),
      modifier('bend', { params: { angle: 0 } }),
      modifier('distort', { params: { type: 'wave', amplitude: 0 } }),
      modifier('distort', { params: { type: 'twist', twist: 0 } }),
    ]) {
      expect(command([idle, sphere]), idle.kind).toBe('x^2+y^2+z^2<1')
    }
  })

  test('a Half acts on each run below it, by its own op', () => {
    const layers = [shape('half', { op: 'cut' }), shape('sphere', { params: { radius: 1 } })]
    const inside = referenceFor(lowerLayers(layers))
    expect(inside(0, 0.5, 0)).toBe(true)
    expect(inside(0, -0.5, 0)).toBe(false)
  })
})

describe('the cone', () => {
  test('is full width at its base and a point at its top', () => {
    const layers = [shape('cone', { params: { radius: 0.4, height: 1 } })]
    const inside = referenceFor(lowerLayers(layers))
    expect(inside(0.38, -0.49, 0)).toBe(true)
    expect(inside(0.05, 0.45, 0)).toBe(false)
    expect(inside(0, 0.45, 0)).toBe(true)
    expect(inside(0, 0.55, 0)).toBe(false)
  })
})
