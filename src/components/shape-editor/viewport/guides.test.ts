import { describe, expect, test } from 'vitest'
import { MODIFIER_KINDS, type ModifierLayer } from '../../../worldedit/stack/layers'
import { modifier } from '../../../worldedit/stack/make'
import { BEND_REACH, bendAngleToward, bendTip, guideOf } from './guides'

const bend = (params: Partial<Extract<ModifierLayer, { kind: 'bend' }>['params']> = {}) => {
  const m = modifier('bend') as Extract<ModifierLayer, { kind: 'bend' }>
  return { ...m.params, ...params }
}

describe('modifier guides', () => {
  test('every modifier draws something', () => {
    for (const kind of MODIFIER_KINDS) {
      const guide = guideOf(modifier(kind))
      expect(guide.lines.length + (guide.plane === null ? 0 : 1)).toBeGreaterThan(0)
      for (const line of guide.lines) expect(line.points.length).toBeGreaterThan(1)
    }
  })

  test('a mirror is a plane square to its axis', () => {
    expect(guideOf(modifier('mirror', { params: { axis: 'z', side: '+' } }))).toEqual({
      lines: [],
      plane: 'z',
    })
  })

  test('an array marks each copy', () => {
    const guide = guideOf(modifier('array', { params: { axis: 'x', spacing: 0.5, count: 4 } }))
    expect(guide.lines).toHaveLength(5)
    expect(guide.lines[0]!.points.at(-1)).toEqual([1.5, 0, 0])
  })

  test('a wave along its own axis draws nothing', () => {
    const m = modifier('distort')
    const flat = { ...m, params: { ...m.params, axis: 'y', along: 'y' } } as ModifierLayer
    expect(guideOf(flat).lines).toEqual([])
  })

  test('a straight bend points its tip along the guide', () => {
    expect(bendTip(bend({ axis: 'y', angle: 0, side: '-' }))).toEqual([0, -BEND_REACH, 0])
  })

  test('dragging the tip back finds the angle it shows', () => {
    for (const angle of [-90, -35, 10, 60]) {
      const params = bend({ axis: 'y', toward: 'x', side: 'both', angle })
      expect(bendAngleToward(params, bendTip(params), false)).toBe(angle)
    }
    const params = bend({ angle: 47 })
    expect(bendAngleToward(params, bendTip(params), true)).toBe(45)
  })
})
