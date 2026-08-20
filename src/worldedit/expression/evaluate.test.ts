import { describe, expect, test } from 'vitest'
import { compileExpression, evaluateGrid } from './index'

/**
 * The performance property `docs/health-checklist.md` § 4 asks for, as an assertion.
 *
 * `evaluate.bench.ts` reports the numbers; this stops them silently getting worse. The
 * threshold is deliberately loose — the point is to catch a *structural* regression, the
 * kind where evaluation goes back to walking the AST and costs 10× or more, not to police
 * a few per cent on a shared CI runner.
 */

const TORUS = '(0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2'
const SIZE = 64
const EVALUATIONS = SIZE ** 3

/**
 * Measured at roughly 80–130 ms on the machine this was written on, so the budget is a
 * three- to five-fold margin. An implementation that dispatched on node kind per voxel
 * would not come close.
 */
const BUDGET_MS = 400

describe('evaluating a region stays within budget', () => {
  test(`${EVALUATIONS.toLocaleString('en-GB')} evaluations of a torus in under ${BUDGET_MS} ms`, () => {
    const result = compileExpression(TORUS)
    if (!result.ok) throw new Error('the torus did not compile')

    // Warm first. The first pass through a closure tree is the one the JIT has not seen,
    // and measuring it would measure the wrong thing.
    evaluateGrid(result.expression, 16)

    const started = performance.now()
    const grid = evaluateGrid(result.expression, SIZE)
    const elapsed = performance.now() - started

    if ('failure' in grid) throw new Error(grid.failure)
    // Sanity: a torus that filled nothing would be very fast and completely wrong.
    expect(grid.filled.some((v) => v === 1)).toBe(true)
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })

  test('compiling is cheap enough to do on every keystroke', () => {
    // Compilation happens once per edit, evaluation once per voxel. If compiling ever
    // became expensive the debounce would be hiding it rather than the other way round.
    const started = performance.now()
    for (let i = 0; i < 100; i++) compileExpression(TORUS)
    const perCompile = (performance.now() - started) / 100
    expect(perCompile).toBeLessThan(5)
  })
})

describe('the closure tree is built once, not per evaluation', () => {
  test('evaluating twice costs about the same as evaluating once, twice', () => {
    // The observable consequence of compiling to closures: there is no per-evaluation
    // setup to amortise. If this ratio drifted far above 1 something would be being
    // rebuilt inside `evaluate`.
    const result = compileExpression(TORUS)
    if (!result.ok) throw new Error('did not compile')
    evaluateGrid(result.expression, 24)

    const time = (runs: number): number => {
      const started = performance.now()
      for (let i = 0; i < runs; i++) evaluateGrid(result.expression, 24)
      return performance.now() - started
    }

    const once = time(4) / 4
    const many = time(16) / 16
    // Generous: this is a smoke test for a structural mistake, not a measurement.
    expect(many).toBeLessThan(once * 3 + 5)
  })
})
