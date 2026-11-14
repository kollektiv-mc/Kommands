import { expect, test } from 'vitest'
import { HERO_SEQUENCE, HERO_SHAPES } from './hero'
import { exprText } from '../../lib/hero/player'
import type { ShapeState } from '../../lib/hero/types'

test('the hero plays the order docs/home-page.md fixes', () => {
  const first = (i: number) => {
    const part = HERO_SEQUENCE[i]?.parts[0]
    return part?.kind === 'literal' ? part.text : ''
  }
  expect(HERO_SEQUENCE.map((_, i) => first(i))).toEqual([
    '/give',
    '/effect give',
    '//generate',
    '/execute',
    '/playsound',
    '//generate',
    '/data merge',
    '/particle',
    '//generate',
  ])
})

test('every shape drags only parameters it starts with, by a gizmo it has', () => {
  for (const shape of HERO_SHAPES) {
    for (const [param, , handle] of shape.drags) {
      expect(shape.init).toHaveProperty(param)
      expect(shape.handles[handle]).toBeDefined()
    }
  }
})

test('every shape builds something, before and after its drags', () => {
  for (const shape of HERO_SHAPES) {
    const end: ShapeState = { ...shape.init, obj: shape.object ? 2 : 0 }
    for (const [param, to] of shape.drags) end[param] = to
    for (const state of [shape.init, end]) {
      const field = shape.field(state)
      let inside = 0
      for (let i = -1; i <= 1; i += 0.1)
        for (let j = -1; j <= 1; j += 0.1) if (field(i, j, 0)) inside++
      expect(inside, shape.block).toBeGreaterThan(0)
    }
  }
})

test('a shape with an object reads alone, added and cut', () => {
  const shape = HERO_SHAPES.find((s) => s.object)
  if (!shape) throw new Error('no shape with an object')
  const at = (obj: number) => exprText(shape, { ...shape.init, obj })
  expect(at(0)).not.toContain('…')
  expect(at(1)).toMatch(/^…\|\|/)
  expect(at(2)).toMatch(/^…&&!\(.*\)$/)
})

test('a dragged number shows with two decimals', () => {
  const tower = HERO_SHAPES[0]
  if (!tower) throw new Error('no shapes')
  expect(exprText(tower, { R: 0.4, H: 0.1 })).toBe('sqrt(x^2+z^2)<0.40&&y<0.10')
})
