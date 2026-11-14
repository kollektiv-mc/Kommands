import { describe, expect, test } from 'vitest'
import { BASE_SEED, seeded } from '../csg/arbitrary'
import {
  duplicate,
  find,
  idleLayers,
  insert,
  isolated,
  move,
  remove,
  slotFor,
  ungroup,
  update,
  wrap,
} from './edit'
import type { Layer } from './layers'
import { group, modifier, reference, shape } from './make'
import { insideStack } from './oracle'

const names = (layers: readonly Layer[]): unknown[] =>
  layers.map((l) => (l.type === 'group' ? { [l.name]: names(l.children) } : l.name))

function sample(): Layer[] {
  return [
    shape('sphere', { name: 'A' }),
    group([shape('box', { name: 'B' }), shape('box', { name: 'C', op: 'cut' })], { name: 'G' }),
    shape('torus', { name: 'D' }),
  ]
}

const idOf = (layers: readonly Layer[], name: string): string => {
  for (const l of layers) {
    if (l.name === name) return l.id
    if (l.type === 'group') {
      const inner = idOf(l.children, name)
      if (inner) return inner
    }
  }
  return ''
}

describe('finding and changing layers', () => {
  test('a layer is found inside its groups', () => {
    const layers = sample()
    const at = find(layers, idOf(layers, 'C'))
    expect(at?.index).toBe(1)
    expect(at?.parents.map((g) => g.name)).toEqual(['G'])
    expect(find(layers, 'nope')).toBeNull()
  })

  test('update and remove reach into groups', () => {
    const layers = sample()
    const renamed = update(layers, idOf(layers, 'B'), (l) => ({ ...l, name: 'B2' }))
    expect(names(renamed)).toEqual(['A', { G: ['B2', 'C'] }, 'D'])
    expect(names(remove(layers, idOf(layers, 'C')))).toEqual(['A', { G: ['B'] }, 'D'])
  })
})

describe('where a new layer goes', () => {
  test('a shape goes below the selection, or into a selected group', () => {
    const layers = sample()
    const box = shape('box', { name: 'N' })
    const below = slotFor(layers, box, idOf(layers, 'B'))
    expect(names(insert(layers, box, below))).toEqual(['A', { G: ['B', 'N', 'C'] }, 'D'])
    const into = slotFor(layers, box, idOf(layers, 'G'))
    expect(names(insert(layers, box, into))).toEqual(['A', { G: ['B', 'C', 'N'] }, 'D'])
    expect(names(insert(layers, box, slotFor(layers, box, null)))).toEqual([
      'A',
      { G: ['B', 'C'] },
      'D',
      'N',
    ])
  })

  test('a modifier goes above the selection, since it acts below', () => {
    const layers = sample()
    const mirror = modifier('mirror', { name: 'M' })
    expect(names(insert(layers, mirror, slotFor(layers, mirror, idOf(layers, 'C'))))).toEqual([
      'A',
      { G: ['B', 'M', 'C'] },
      'D',
    ])
    expect(names(insert(layers, mirror, slotFor(layers, mirror, null)))[0]).toBe('M')
  })
})

describe('moving a layer', () => {
  test('down its own list, counting the slot before the move', () => {
    const layers = sample()
    expect(names(move(layers, idOf(layers, 'A'), { parent: null, index: 3 }))).toEqual([
      { G: ['B', 'C'] },
      'D',
      'A',
    ])
  })

  test('into a group, and never into itself', () => {
    const layers = sample()
    const g = idOf(layers, 'G')
    expect(names(move(layers, idOf(layers, 'D'), { parent: g, index: 0 }))).toEqual([
      'A',
      { G: ['D', 'B', 'C'] },
    ])
    const nested = insert(layers, group([], { name: 'H' }), { parent: g, index: 0 })
    expect(move(nested, g, { parent: idOf(nested, 'H'), index: 0 })).toBe(nested)
  })
})

describe('duplicate, wrap and ungroup', () => {
  test('a duplicate sits below with fresh ids, nudged', () => {
    const layers = sample()
    const { layers: out, id } = duplicate(layers, idOf(layers, 'G'))
    expect(names(out)).toEqual(['A', { G: ['B', 'C'] }, { 'G copy': ['B', 'C'] }, 'D'])
    const copy = find(out, id!)!.layer
    expect(copy.pos).toEqual([0.1, 0, 0.1])
    const ids = [...JSON.stringify(out).matchAll(/"id":"([^"]+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('a wrapped layer hands its op to the group', () => {
    const layers = sample()
    const { layers: out, id } = wrap(layers, idOf(layers, 'C'))
    const outer = find(out, id!)!.layer
    expect(outer.type === 'group' && outer.op).toBe('cut')
    expect(
      outer.type === 'group' && outer.children[0]?.type === 'shape' && outer.children[0].op,
    ).toBe('add')
  })

  test('ungrouping a placed group moves nothing', () => {
    const inner = [
      shape('box', {
        params: { width: 0.5, height: 0.3, depth: 0.2 },
        pos: [0.2, 0, 0],
        rot: [0, 0, 30],
      }),
      shape('sphere', { params: { radius: 0.2 }, pos: [-0.2, 0.1, 0], op: 'cut' }),
    ]
    const layers: Layer[] = [
      group(inner, { pos: [0.1, -0.2, 0.3], rot: [20, 45, 0], scl: [1.5, 1.5, 1.5] }),
    ]
    const { layers: flat } = ungroup(layers, layers[0]!.id)
    expect(flat).toHaveLength(2)
    const random = seeded(BASE_SEED)
    for (let i = 0; i < 400; i++) {
      const p: [number, number, number] = [random() - 0.5, random() - 0.5, random() - 0.5]
      expect(insideStack(flat, p), `(${p.join(', ')})`).toBe(insideStack(layers, p))
    }
  })
})

describe('idle layers', () => {
  test('are a modifier with nothing below and a cut with nothing above', () => {
    const layers: Layer[] = [
      shape('box', { name: 'Cut', op: 'cut' }),
      shape('sphere'),
      reference(),
      modifier('mirror', { name: 'Mirror' }),
    ]
    const idle = idleLayers(layers)
    expect([...idle.keys()]).toEqual([layers[0]!.id, layers[3]!.id])
  })
})

describe('isolating a layer', () => {
  test('keeps it inside its groups, as an Add', () => {
    const layers = sample()
    const view = isolated(layers, idOf(layers, 'C'))!
    expect(names(view)).toEqual([{ G: ['C'] }])
    const g = view[0]
    expect(g?.type === 'group' && g.children[0]?.type === 'shape' && g.children[0].op).toBe('add')
  })

  test('and a modifier keeps what it acts on', () => {
    const layers = [
      shape('box', { name: 'A' }),
      modifier('mirror', { name: 'M' }),
      shape('box', { name: 'B' }),
    ]
    expect(names(isolated(layers, idOf(layers, 'M'))!)).toEqual(['M', 'B'])
  })
})
