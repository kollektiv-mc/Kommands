import { describe, expect, test } from 'vitest'
import { compileExpression } from './index'
import { SHAPE_CASES, SPEC_CASES } from './corpus'

/**
 * The corpus is WorldEdit's own test suite, ported.
 *
 * `ExpressionTest.java` and `RealExpressionTest.java` are the specification for this
 * language — there is no written one — so these are transcribed rather than invented, and
 * a case that disagrees with upstream is this implementation being wrong, not the case.
 *
 * The cases themselves live in `corpus.ts`, because `print.test.ts` reads the same
 * sources to check that printing an AST and parsing it back is the identity — and a test
 * file cannot be imported for its data without re-running its `test` registrations. What
 * stays here is everything that is an argument rather than a case: the traps, and why
 * each group of them earns its keep.
 *
 * The world-reading cases are the only ones left behind, and deliberately: they are out
 * of scope with world masking. See docs/generate-editor.md § Masking.
 *
 * That sentence was untrue once and is worth the warning. `~`, `<<` and `>>` were live
 * code with no test whatsoever, and four `RealExpressionTest` shapes were missing, while
 * this comment claimed the port was otherwise complete. A scope note is a claim like any
 * other; it needs checking against the thing it describes.
 */

/** Compile and evaluate at a point, failing loudly if the source did not compile. */
const at = (source: string, x = 0, y = 0, z = 0): number => {
  const result = compileExpression(source)
  if (!result.ok) {
    throw new Error(`${source} — ${result.diagnostics.map((d) => d.message).join(' ')}`)
  }
  return result.expression.evaluate(x, y, z)
}

const check = (cases: Readonly<Record<string, number>>): void => {
  for (const [source, expected] of Object.entries(cases)) {
    test(`${source} → ${expected}`, () => expect(at(source)).toBe(expected))
  }
}

describe('arithmetic and precedence', () => {
  check(SPEC_CASES['arithmetic and precedence'])

  test('^ is exponentiation, not xor', () => {
    // The single most likely thing to get wrong by importing habits from C.
    expect(at('2^10')).toBe(1024)
    expect(at('2**10')).toBe(1024)
  })

  test('^ is left-associative, and every prefix operator binds tighter than it', () => {
    // Both halves are the reverse of mathematical convention, and both were wrong here
    // until the grammar was read instead of assumed. `powerExpression` is left-recursive
    // with no <assoc=right>, and BOTH its operands are typed `unaryExpression` — a rule
    // that sits below it and cannot climb back except through parentheses. So the two
    // "obvious" readings are not merely unselected, they are underivable.
    expect(at('2^3^2')).toBe(64) // (2^3)^2, not 2^(3^2) = 512
    expect(at('2^(3^2)')).toBe(512) // the parenthesised form is the only route to 512
    expect(at('-2^2')).toBe(4) // (-2)^2, not -(2^2) = -4
    expect(at('~2^2')).toBe(9) // (~2)^2 = (-3)^2; `~` is below `^` for the same reason
    expect(at('2^-1')).toBe(0.5) // but the *right* operand may still be unary
  })
})

/**
 * `~` and the shifts were implemented and had no test whatsoever until this was noticed.
 * Upstream's `testComplement` and `testShift`, transcribed — including its own comment,
 * because "it drops the decimal!" is the whole content of four of the eleven cases.
 */
describe('~ is integer complement, and truncates first', () => {
  check(SPEC_CASES['~ is integer complement, and truncates first'])
})

describe('<< and >> shift as integers', () => {
  check(SPEC_CASES['<< and >> shift as integers'])
})

describe('min and max take any number of arguments', () => {
  check(SPEC_CASES['min and max take any number of arguments'])
})

describe('the maths built-ins are the platform ones', () => {
  check(SPEC_CASES['the maths built-ins are the platform ones'])
})

describe('&& and || return an operand, not a boolean', () => {
  // The trap. A version normalising to 0/1 passes most of the suite and fails these four,
  // which is exactly why upstream wrote them.
  check(SPEC_CASES['&& and || return an operand, not a boolean'])
})

describe('the conditional operator, including nested', () => {
  check(SPEC_CASES['the conditional operator, including nested'])
})

describe('unary not treats any non-zero as true', () => {
  check(SPEC_CASES['unary not treats any non-zero as true'])
})

describe('comparison', () => {
  check(SPEC_CASES.comparison)
})

describe('~= compares by units in the last place, not by a tolerance', () => {
  check(SPEC_CASES['~= compares by units in the last place, not by a tolerance'])
})

describe('postfix ! is factorial', () => {
  check(SPEC_CASES['postfix ! is factorial'])
})

describe('assignment, sequencing, and the last value as the result', () => {
  check(SPEC_CASES['assignment, sequencing, and the last value as the result'])
})

describe('increment and decrement, before and after', () => {
  check(SPEC_CASES['increment and decrement, before and after'])
})

describe('return leaves immediately', () => {
  check(SPEC_CASES['return leaves immediately'])
})

describe('control flow', () => {
  check(SPEC_CASES['control flow'])
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

describe('rotate and swap write back to their arguments', () => {
  // The only two functions in the language that take a parameter by reference —
  // `Variable` rather than `double` in `Functions.java`. Both return 0, so they are
  // called for their effect and the shape test comes after.
  test('rotate turns the pair a quarter turn', () => {
    // (1, 0) rotated by pi/2 is (0, 1). Compared loosely because cos(pi/2) is not
    // exactly zero in floating point, which is the correct answer rather than a defect.
    expect(at('rotate(x, y, pi/2); y', 1, 0, 0)).toBeCloseTo(1)
    expect(at('rotate(x, y, pi/2); x', 1, 0, 0)).toBeCloseTo(0)
  })

  test('rotate is what tilts a shape, so it composes with one', () => {
    // The reason it matters: a torus that is upright without it and tilted with it.
    //
    // The sample point has to sit *off* the axis being rotated about. (0.75, 0, 0) is on
    // the rim but has y = z = 0, so turning the y/z pair leaves it exactly where it was
    // and both forms agree — a test that would have passed against a rotate that did
    // nothing at all. (0, 0.75, 0) is the same rim point a quarter turn round, and it
    // moves to (0, 0, 0.75), which the upright torus does not contain.
    const TORUS = '(0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2'
    expect(at(TORUS, 0, 0.75, 0)).toBe(1)
    expect(at(`rotate(y, z, pi/2); ${TORUS}`, 0, 0.75, 0)).toBe(0)
  })

  test('swap exchanges two variables', () => {
    expect(at('swap(x, y); x', 1, 2, 0)).toBe(2)
    expect(at('swap(x, y); y', 1, 2, 0)).toBe(1)
  })

  test('they work on variables the source made up, not just x/y/z', () => {
    expect(at('a=3; b=4; swap(a, b); a*10+b')).toBe(43)
  })
})

describe('the megabuf scratch store', () => {
  check(SPEC_CASES['the megabuf scratch store'])

  test('closest finds the nearest stored point and returns its index', () => {
    // Two points in the buffer, stride 3: (5,0,0) at index 0 and (-5,0,0) at index 3.
    const buffer =
      'megabuf(0,5); megabuf(1,0); megabuf(2,0); megabuf(3,-5); megabuf(4,0); megabuf(5,0); '
    expect(at(`${buffer}closest(x,y,z,0,2,3)`, 4, 0, 0)).toBe(0)
    expect(at(`${buffer}closest(x,y,z,0,2,3)`, -4, 0, 0)).toBe(3)
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
  const shape = (
    source: string,
    points: ReadonlyArray<readonly [number, number, number, number]>,
  ) => {
    const result = compileExpression(source)
    if (!result.ok) throw new Error(result.diagnostics.map((d) => d.message).join(' '))
    for (const [x, y, z, expected] of points) {
      const actual = result.expression.evaluate(x, y, z)
      expect(actual > 0 ? 1 : 0, `at (${x}, ${y}, ${z})`).toBe(expected)
    }
  }

  for (const fixture of SHAPE_CASES) {
    test(fixture.name, () => shape(fixture.source, fixture.points))
  }

  test('rainbow egg walks data through all sixteen values', () => {
    const source = 'data=(32+y*16+1)%16; y^2/9+x^2/6*(1/(1-0.4*y))+z^2/6*(1/(1-0.4*y))<0.08'
    const result = compileExpression(source)
    if (!result.ok) throw new Error('did not compile')
    // Fifteen samples up the axis of the egg, each one data step apart.
    for (let i = 0; i < 15; i++) {
      const y = i / 16 - 0.5
      expect(result.expression.evaluate(0, y, 0) > 0 ? 1 : 0, `filled at y=${y}`).toBe(1)
      expect(Math.floor(result.expression.slot('data')), `data at y=${y}`).toBe((i + 9) % 16)
    }
    // And one point outside it.
    expect(result.expression.evaluate(0, 1, 0) > 0 ? 1 : 0).toBe(0)
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
