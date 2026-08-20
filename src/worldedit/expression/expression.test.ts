import { describe, expect, test } from 'vitest'
import { compileExpression } from './index'

/**
 * The corpus is WorldEdit's own test suite, ported.
 *
 * `ExpressionTest.java` and `RealExpressionTest.java` are the specification for this
 * language — there is no written one — so these are transcribed rather than invented, and
 * a case that disagrees with upstream is this implementation being wrong, not the case.
 *
 * The world-reading cases are the only ones left behind: they are out of scope with world
 * masking. See docs/generate-editor.md § Masking.
 */

/** Compile and evaluate at a point, failing loudly if the source did not compile. */
const at = (source: string, x = 0, y = 0, z = 0): number => {
  const result = compileExpression(source)
  if (!result.ok) {
    throw new Error(`${source} — ${result.diagnostics.map((d) => d.message).join(' ')}`)
  }
  return result.expression.evaluate(x, y, z)
}

const check = (cases: Record<string, number>): void => {
  for (const [source, expected] of Object.entries(cases)) {
    test(`${source} → ${expected}`, () => expect(at(source)).toBe(expected))
  }
}

describe('arithmetic and precedence', () => {
  check({
    '1 - 2 + 3': 2,
    '2 + +4': 6,
    '2 - -4': 6,
    '2 * -4': -8,
    '3+1': 4,
  })

  test('^ is exponentiation, not xor', () => {
    // The single most likely thing to get wrong by importing habits from C.
    expect(at('2^10')).toBe(1024)
    expect(at('2**10')).toBe(1024)
  })

  test('^ is right-associative and binds tighter than a unary minus on its left', () => {
    expect(at('2^3^2')).toBe(512) // 2^(3^2), not (2^3)^2 = 64
    expect(at('-2^2')).toBe(-4) // -(2^2), not (-2)^2 = 4
  })
})

describe('min and max take any number of arguments', () => {
  check({
    'min(1, 2)': 1,
    'max(1, 2)': 2,
    'max(1, 2, 3, 4, 5)': 5,
  })
})

describe('&& and || return an operand, not a boolean', () => {
  // The trap. A version normalising to 0/1 passes most of the suite and fails these four,
  // which is exactly why upstream wrote them.
  check({
    '0 || 5': 5,
    '2 || 5': 2,
    '2 && 5': 5,
    '5 && 0': 0,
  })
})

describe('the conditional operator, including nested', () => {
  check({
    'false ? 1 : 2': 2,
    'true ? 1 : 2': 1,
    'true ? true ? 1 : 2 : 3': 1,
    'true ? false ? 1 : 2 : 3': 2,
    'false ? true ? 1 : 2 : 3': 3,
    'false ? false ? 1 : 2 : 3': 3,
  })
})

describe('unary not treats any non-zero as true', () => {
  check({ '!0': 1, '!1': 0, '!2': 0, '!-1': 0, '!-2': 0 })
})

describe('comparison', () => {
  check({
    '1>=0': 1,
    '1>0': 1,
    '0>=0': 1,
    '0>0': 0,
    '0<=1': 1,
    '0<1': 1,
    '0<=0': 1,
    '0<0': 0,
    '1>=2': 0,
    '1>2': 0,
    '0>=1': 0,
    '0>1': 0,
    '2<=1': 0,
    '2<1': 0,
    '1<=0': 0,
    '1<0': 0,
    '1==1': 1,
    '0==1': 0,
    '1==0': 0,
    '1!=1': 0,
    '0!=1': 1,
    '1!=0': 1,
    '1.1==1.1': 1,
  })
})

describe('~= compares by units in the last place, not by a tolerance', () => {
  check({
    '1!=0.999999999': 1,
    '1~=0.999999999': 1,
    '1~=0.9': 0,
  })
})

describe('postfix ! is factorial', () => {
  check({
    '0!': 1,
    '1!': 1,
    '2!': 2,
    // Truncated, not rounded: 2! rather than 3!.
    '2.9!': 2,
    // Negative is zero rather than an error, which is upstream's choice.
    '(-1)!': 0,
  })
})

describe('assignment, sequencing, and the last value as the result', () => {
  check({
    'a=2; a^=3; a': 8,
    'a=2; a*=3; a': 6,
    'a=2; a/=2; a': 1,
    'a=2; a%=3; a': 2,
    'a=2; a+=3; a': 5,
    'a=2; a-=3; a': -1,
  })
})

describe('increment and decrement, before and after', () => {
  check({
    'a=0; b=a++; a+b': 1,
    'a=0; b=++a; a+b': 2,
    'a=0; b=a--; a+b': -1,
    'a=0; b=--a; a+b': -2,
  })
})

describe('return leaves immediately', () => {
  check({ 'return 1; 0': 1 })
})

describe('control flow', () => {
  check({
    'y=0; if (1) x=4; else y=5; x*10+y;': 40,
    'x=0; if (0) x=4; else y=5; x*10+y;': 5,
    'c=5; a=0; while (c > 0) { ++a; --c; } a': 5,
    'c=5; a=0; do { ++a; --c; } while (c > 0); a': 5,
    'a=0; for (i=0; i<5; ++i) { ++a; } a': 5,
    // WorldEdit's range form: `for (counter = first, last)`, inclusive.
    'y=0; for (i=1,5) { y *= 10; y += i; } y': 12345,
  })
})

describe('switch, including fallthrough', () => {
  const withBreaks = (n: number) =>
    `x=1;y=2;z=3;switch (${n}) { case 1: x=5; break; case 2: y=6; break; default: z=7; break } x*100+y*10+z`
  const withoutBreaks = (n: number) =>
    `x=1;y=2;z=3;switch (${n}) { case 1: x=5; case 2: y=6; default: z=7 } x*100+y*10+z`

  test('break stops at the matched case', () => {
    expect(at(withBreaks(1))).toBe(523)
    expect(at(withBreaks(2))).toBe(163)
    expect(at(withBreaks(3))).toBe(127)
  })

  test('without break, a match falls through everything after it', () => {
    expect(at(withoutBreaks(1))).toBe(567)
    expect(at(withoutBreaks(2))).toBe(167)
    // No case matches, so only the default runs.
    expect(at(withoutBreaks(3))).toBe(127)
  })

  test('a switch with no default does nothing when nothing matches', () => {
    expect(at('x=1;y=2;z=3;switch (1) { case 1: x=5; case 2: y=6 } x*100+y*10+z')).toBe(563)
  })
})

describe('constants', () => {
  test('e and pi are the real ones', () => {
    expect(at('e')).toBe(Math.E)
    expect(at('pi')).toBe(Math.PI)
  })

  test('true and false are 1 and 0', () => {
    expect(at('true')).toBe(1)
    expect(at('false')).toBe(0)
  })
})

describe('x, y and z are the inputs', () => {
  test('and are read at the point being evaluated', () => {
    expect(at('x*100+y*10+z', 1, 2, 3)).toBe(123)
  })

  test('and are writable, because the language does not stop you', () => {
    expect(at('x=9; x', 1, 2, 3)).toBe(9)
  })
})

/**
 * Real `//generate` shapes, from `RealExpressionTest.java`.
 *
 * These are the ones that matter: a torus that is subtly wrong is the failure mode this
 * whole product exists to avoid, and a per-point expectation catches it where a
 * smoke test would not.
 */
describe('the shapes people actually generate', () => {
  const shape = (source: string, points: Array<[number, number, number, number]>) => {
    const result = compileExpression(source)
    if (!result.ok) throw new Error(result.diagnostics.map((d) => d.message).join(' '))
    for (const [x, y, z, expected] of points) {
      const actual = result.expression.evaluate(x, y, z)
      expect(actual > 0 ? 1 : 0, `at (${x}, ${y}, ${z})`).toBe(expected)
    }
  }

  test('torus', () => {
    shape('(0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2', [
      [0, 0, 0, 0],
      [0.5, 0.5, 0.5, 0],
      [1, 0, 0, 0],
      [0.5, 0.5, 0, 1],
      [0.75, 0.5, 0, 1],
      [0.75, 0, 0, 1],
    ])
  })

  test('gnarled oak tree', () => {
    shape('(0.5+sin(atan2(x,z)*8)*0.2)*(sqrt(x*x+z*z)/0.5)^(-2)-1.2 < y', [
      [-1, -1, -1, 1],
      [-1, 0, 1, 1],
      [1, 1, 1, 1],
      [0, 0, -1, 1],
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      // The pair that pins the boundary: one ten-thousandth apart, either side of it.
      [0, 0, 0.32274, 0],
      [0, 0, 0.32275, 1],
    ])
  })

  test('heart', () => {
    shape('(z/2)^2+x^2+(5*y/4-sqrt(abs(x)))^2<0.6', [
      [0, 0, -1, 1],
      [0, 1, -1, 0],
      [-0.5, 1, 0, 1],
    ])
  })

  test('rainbow torus sets data as well as placing blocks', () => {
    // The material channel: an expression may assign `data` to choose a block per voxel.
    const result = compileExpression(
      'data=(32+15/2/pi*atan2(x,y))%16; (0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2',
    )
    if (!result.ok) throw new Error('did not compile')
    for (const [x, y, z, filled, data] of [
      [0, 0, 0, 0, 0],
      [0.5, 0.5, 0, 1, 1],
      [0.75, 0.5, 0, 1, 2],
      [0.75, 0, 0, 1, 3],
    ] as const) {
      const placed = result.expression.evaluate(x, y, z) > 0 ? 1 : 0
      expect(placed, `placed at (${x}, ${y}, ${z})`).toBe(filled)
      if (filled) expect(Math.floor(result.expression.slot('data')), `data`).toBe(data)
    }
  })
})
