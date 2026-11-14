import { describe, expect, test } from 'vitest'
import { readGenerate, stackCommand } from './command'
import { modifier, shape } from './make'

const base = { pattern: 'stone', hollow: false, round: false }

describe('the command a stack writes', () => {
  test('carries the pattern, Hollow and the expression', () => {
    const layers = [shape('sphere', { params: { radius: 1 } })]
    expect(stackCommand({ ...base, layers }).text).toBe('//generate stone x^2+y^2+z^2<1')
    expect(stackCommand({ ...base, layers, hollow: true, pattern: '50%stone,50%dirt' }).text).toBe(
      '//generate -h 50%stone,50%dirt x^2+y^2+z^2<1',
    )
  })

  test('an empty stack has no expression', () => {
    const command = stackCommand({ ...base, layers: [] })
    expect(command.expression).toBe('')
    expect(command.text).toBe('//generate stone')
  })

  test('Round numbers shortens what a turn writes', () => {
    const layers = [shape('box', { rot: [0, 30, 0] })]
    const exact = stackCommand({ ...base, layers })
    const rounded = stackCommand({ ...base, layers, round: true })
    expect(rounded.text.length).toBeLessThan(exact.text.length)
    expect(rounded.text).not.toMatch(/\d{5}/)
  })

  test('says where it fits, and counts shared parts', () => {
    const small = stackCommand({ ...base, layers: [shape('sphere')] })
    expect(small.fits).toBe('chat')
    const many = Array.from({ length: 40 }, (_, i) =>
      shape('box', { pos: [i / 40, 0, 0], rot: [i, 0, 0] }),
    )
    expect(stackCommand({ ...base, layers: many }).fits).toBe('command block')
    const twice = [
      shape('sphere', { params: { radius: 0.8 } }),
      shape('sphere', { params: { radius: 0.6 }, op: 'cut' }),
      modifier('mirror'),
    ]
    expect(stackCommand({ ...base, layers: twice }).shared).toBeGreaterThanOrEqual(1)
  })
})

describe('reading a pasted command back', () => {
  test('takes the flags, the blocks and the expression', () => {
    expect(readGenerate('//gen -hr 50%stone,dirt x^2 + y^2 < 1')).toEqual({
      ok: true,
      hollow: true,
      pattern: '50%stone,dirt',
      expression: 'x^2 + y^2 < 1',
    })
  })

  test('reads what a stack writes', () => {
    const { text } = stackCommand({ ...base, hollow: true, layers: [shape('sphere')] })
    expect(readGenerate(text)).toMatchObject({ ok: true, hollow: true, pattern: 'stone' })
  })

  test('refuses another command, or one with nothing to draw', () => {
    expect(readGenerate('/give @p stone')).toMatchObject({ ok: false })
    expect(readGenerate('//generate stone')).toMatchObject({ ok: false })
  })
})
