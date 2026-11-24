import { expect, test } from 'vitest'
import { HERO_SLOTS, HERO_SHAPES } from './hero'
import { exprText } from '../../lib/hero/player'
import { cellCentre } from '../../lib/hero/voxels'
import type { HeroArg, HeroCommand, ShapeState } from '../../lib/hero/types'
import { serializeMask } from '../../schema/argument-types/we-mask'
import { serializePattern } from '../../schema/argument-types/we-pattern'
import { compileExpression } from '../../worldedit/expression'
import generated from '../generated/1.21.1/registries.json'

const REGISTRIES: Readonly<Record<string, readonly string[]>> = generated.registries

/** What a command starts with: its own word, or the Palette Editor's Command tile. */
const head = (h: HeroCommand) => {
  const part = h.parts[0]
  return part?.kind === 'literal' ? part.text : (part?.value ?? '')
}

test('the hero plays the commands docs/home-page.md lists', () => {
  expect(HERO_SLOTS.map((slot) => [...new Set(slot.map(head))].join(' | '))).toEqual([
    '/give',
    '/effect give',
    '//generate',
    '/execute',
    '//replace | /brush | //set | //smooth',
    '/data merge | /data modify',
    '/playsound',
    '/particle',
  ])
})

/** A command's text as the hero types it, every part in full. */
const typed = (h: HeroCommand) =>
  h.parts.map((p) => (p.kind === 'literal' ? p.text : p.value + (p.raw ?? ''))).join(' ')

const arg = (h: HeroCommand, label: string) => {
  const part = h.parts.find((p): p is HeroArg => p.kind === 'arg' && p.label === label)
  if (!part) throw new Error(`no ${label} in ${typed(h)}`)
  return part.value + (part.raw ?? '')
}

test('the Palette Editor lines are what its serializers write', () => {
  const lines = [...new Set(HERO_SLOTS.flat())].filter((h) => h.parts[0]?.kind === 'arg')
  const mask = (include: string[], exclude: string[], chance: number | '') =>
    serializeMask({ include, exclude, chance, rules: [] })
  const pattern = (...entries: [number, string][]) =>
    serializePattern({ entries: entries.map(([weight, block]) => ({ weight, block })) })
  expect(lines.map(typed)).toEqual([
    `//replace ${mask(['stone', 'andesite'], [], 40)} ${pattern([3, 'cobblestone'], [2, 'mossy_cobblestone'], [1, 'gravel'])}`,
    `/brush sphere -h ${pattern([3, 'glass'], [1, 'tinted_glass'])} 6`,
    `//set ${pattern([4, 'stone_bricks'], [2, 'mossy_stone_bricks'], [1, 'cracked_stone_bricks'])}`,
    `//smooth 4 ${mask(['#dirt'], ['podzol'], '')}`,
  ])
  // The order of each line's arguments is the definition's.
  const smooth = lines.find((h) => head(h) === '//smooth')
  if (!smooth) throw new Error('no //smooth')
  expect(arg(smooth, 'Passes')).toBe('4')
})

test('every id the hero names is in Java Edition 1.21.1', () => {
  const ids = [
    ...HERO_SHAPES.map((v) => ['block', v.block]),
    ['item', 'diamond_sword'],
    ['item', 'bow'],
    ['item', 'potion'],
    ['item', 'trident'],
    ['enchantment', 'sharpness'],
    ['enchantment', 'power'],
    ['enchantment', 'flame'],
    ['enchantment', 'loyalty'],
    ['enchantment', 'channeling'],
    ['potion', 'strong_swiftness'],
    ['data_component_type', 'unbreakable'],
    ['data_component_type', 'custom_name'],
    ['data_component_type', 'potion_contents'],
    ['item', 'torch'],
    ['block', 'torch'],
    ['block', 'magma_block'],
    ['item', 'diamond'],
    ['block', 'cobblestone'],
    ['block', 'mossy_cobblestone'],
    ['block', 'gravel'],
    ['block', 'glass'],
    ['block', 'tinted_glass'],
    ['block', 'cracked_stone_bricks'],
    ['block', 'podzol'],
    ['tag/block', 'dirt'],
  ]
  const missing = ids.filter(([registry, id]) => !REGISTRIES[registry ?? '']?.includes(id ?? ''))
  expect(missing).toEqual([])
})

test("every structure builds what its expression says, in WorldEdit's own grammar", () => {
  for (const v of HERO_SHAPES) {
    const end: ShapeState = { ...v.init, obj: v.object ? 2 : 0 }
    for (const [param, to] of v.drags) end[param] = to
    const states: ShapeState[] = v.object ? [0, 1, 2].map((obj) => ({ ...v.init, obj })) : [v.init]
    for (const state of [...states, end]) {
      const source = v
        .expr(state)
        .map((t) =>
          typeof t === 'string' ? t : 'fold' in t ? t.fold : (state[t.param] ?? 0).toFixed(2),
        )
        .join('')
      const compiled = compileExpression(source)
      if (!compiled.ok) throw new Error(`${v.block}: ${source}`)
      expect(compiled.diagnostics, source).toEqual([])
      const field = v.field(state)
      let differ = 0
      for (let i = 0; i < v.n; i++) {
        for (let j = 0; j < v.n; j++) {
          for (let k = 0; k < v.n; k++) {
            const [x, y, z] = cellCentre([i - (v.n - 1) / 2, j, k - (v.n - 1) / 2], v.n)
            if (field(x, y, z) !== compiled.expression.evaluate(x, y, z) > 0) differ++
          }
        }
      }
      expect(differ, source).toBe(0)
    }
  }
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
  expect(at(0)).not.toMatch(/^…$/)
  expect(at(1)).toMatch(/^…\|\|/)
  expect(at(2)).toMatch(/^…&&!\(.*\)$/)
})

// The layout reserves the expression a structure ends on, so one typed much longer
// spills past its tile and snaps back when it folds.
test('every expression the hero shows fits on one line of its tile', () => {
  for (const v of HERO_SHAPES) {
    const states: ShapeState[] = v.object ? [0, 1, 2].map((obj) => ({ ...v.init, obj })) : []
    const end: ShapeState = { ...v.init, obj: v.object ? 2 : 0 }
    for (const [param, to] of v.drags) end[param] = to
    for (const state of [v.init, ...states, end]) {
      const text = exprText(v, state)
      expect(text.length, `${v.block}: ${text}`).toBeLessThanOrEqual(40)
    }
  }
})

test('a dragged number shows with two decimals', () => {
  const heart = HERO_SHAPES.find((v) => v.block === 'red_terracotta')
  if (!heart) throw new Error('no heart')
  expect(exprText(heart, { K: 1.25, S: 0.3 })).toBe('…+(1.25*y+0.25-sqrt(abs(x)))^2<0.30')
})
