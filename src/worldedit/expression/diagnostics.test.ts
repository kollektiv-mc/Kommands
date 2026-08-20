import { describe, expect, test } from 'vitest'
import { compileExpression, evaluateGrid, expressionDiagnostics } from './index'

/**
 * What the evaluator says when an expression is wrong, and what it refuses to say when it
 * is merely unsupported.
 *
 * The distinction is the point. A formula using `perlin` is a perfectly good `//generate`
 * command that this preview cannot draw; a formula using `frobnicate` is a typo. Reporting
 * them the same way would teach people to ignore both.
 */

const messages = (source: string): string[] => expressionDiagnostics(source).map((d) => d.message)

describe('a source that does not parse', () => {
  test('an unclosed bracket is reported, not thrown', () => {
    expect(compileExpression('sin(x').ok).toBe(false)
    expect(messages('sin(x')).toHaveLength(1)
  })

  test('two operators in a row', () => {
    expect(messages('2 +* 3')).toHaveLength(1)
  })

  test('a stray closing bracket', () => {
    expect(messages('x*8)')).toHaveLength(1)
  })

  test('an empty source is not an error — it is unfinished', () => {
    // The serializer already shows an unfilled required argument as a gap. Saying it
    // twice, in two vocabularies, helps nobody.
    expect(messages('')).toEqual([])
    expect(messages('   ')).toEqual([])
  })

  test('one typo produces one message, not a cascade', () => {
    // A parser that has lost its place will report the same position repeatedly. A field
    // showing six warnings for one mistake is worse than showing none.
    expect(messages('x < < < 1').length).toBeLessThanOrEqual(2)
  })
})

describe('a source that parses but cannot be evaluated here', () => {
  test('an unknown function is named as a typo', () => {
    const [first] = messages('frobnicate(x)')
    expect(first).toContain('frobnicate')
    expect(first).toContain('not a function')
  })

  test('the wrong number of arguments says how many it wanted', () => {
    const [first] = messages('atan2(x)')
    expect(first).toContain('2')
  })

  test('a world-reading function says why, rather than calling it a typo', () => {
    const [first] = messages('query(0,0,0,1,0)')
    expect(first).toContain('world')
    expect(first).not.toContain('not a function')
  })

  test('noise says it is unported rather than pretending', () => {
    const [first] = messages('perlin(x,y,z,1,1,1)')
    expect(first).toContain('ported')
  })

  test('and it still compiles, because the command itself is valid in game', () => {
    // This is the whole reason `ok` and `diagnostics` are separate. The user can copy a
    // perlin command and run it; we simply cannot draw it for them.
    const result = compileExpression('perlin(x,y,z,1,1,1) > 0')
    expect(result.ok).toBe(true)
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })
})

describe('an expression that does not finish', () => {
  test('stops with a diagnostic rather than hanging the tab', () => {
    const result = compileExpression('while (1) { x = x + 1 } x', { stepLimit: 1000 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(() => result.expression.evaluate(0, 0, 0)).toThrow(/did not finish/)
  })

  test('and a grid evaluation reports it instead of throwing', () => {
    const result = compileExpression('while (1) { x = x + 1 } x', { stepLimit: 1000 })
    if (!result.ok) throw new Error('should have compiled')
    const grid = evaluateGrid(result.expression, 4)
    expect('failure' in grid).toBe(true)
  })

  test('the budget is per point, not per grid', () => {
    // A loop that runs a few times per voxel is normal and must not exhaust a budget
    // shared across 262,144 of them.
    const result = compileExpression('a=0; for (i=1,50) { a += i } a > 0', { stepLimit: 1000 })
    if (!result.ok) throw new Error('should have compiled')
    const grid = evaluateGrid(result.expression, 8)
    expect('failure' in grid).toBe(false)
  })
})

describe('evaluating across a grid', () => {
  test('x, y and z run -1..1, matching //generate default origin', () => {
    const result = compileExpression('x')
    if (!result.ok) throw new Error('should have compiled')
    expect(result.expression.evaluate(-1, 0, 0)).toBe(-1)
    expect(result.expression.evaluate(1, 0, 0)).toBe(1)
  })

  test('a unit sphere fills the middle and misses the corners', () => {
    const result = compileExpression('x^2+y^2+z^2 < 1')
    if (!result.ok) throw new Error('should have compiled')
    const grid = evaluateGrid(result.expression, 9)
    if ('failure' in grid) throw new Error(grid.failure)

    const index = (ix: number, iy: number, iz: number) => ix + iy * 9 + iz * 81
    // Centre of the grid is the centre of the sphere.
    expect(grid.filled[index(4, 4, 4)]).toBe(1)
    // Every corner is at distance sqrt(3), well outside radius 1.
    for (const corner of [0, 8]) {
      for (const y of [0, 8]) {
        for (const z of [0, 8]) expect(grid.filled[index(corner, y, z)]).toBe(0)
      }
    }
  })

  test('a shape reports which slots it depends on', () => {
    const result = compileExpression('data = 3; x^2 < 1')
    if (!result.ok) throw new Error('should have compiled')
    expect(result.expression.slots).toContain('data')
    expect(result.expression.slots).toContain('x')
  })

  test('one point does not leak its variables into the next', () => {
    // Slots are cleared per evaluation. Without that, an expression that reads before it
    // writes would see the previous voxel's value — invisible until it matters.
    const result = compileExpression('a = a + 1; a')
    if (!result.ok) throw new Error('should have compiled')
    expect(result.expression.evaluate(0, 0, 0)).toBe(1)
    expect(result.expression.evaluate(0, 0, 0)).toBe(1)
  })
})
