import { bench, describe } from 'vitest'
import { compileExpression, evaluateGrid } from './index'

/**
 * `docs/health-checklist.md` § 4: the evaluator "compiles to a closure tree rather than
 * walking the AST per voxel, and has been benchmarked before being wired to a canvas".
 * This is that benchmark. `evaluate.test.ts` turns its headline number into an assertion
 * so a regression fails CI rather than being noticed later.
 *
 * The grid is 64³ — 262,144 evaluations — because that is the figure the checklist names
 * as one region's worth of work per input change.
 *
 * Run with `pnpm vitest bench src/worldedit/expression`.
 */

const SIZE = 64

const SHAPES: Readonly<Record<string, string>> = {
  sphere: 'x^2+y^2+z^2 < 1',
  torus: '(0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2',
  // Six trig calls per voxel — the expensive end of what people actually write.
  gyroid: 'sin(x*6)*cos(y*6)+sin(y*6)*cos(z*6)+sin(z*6)*cos(x*6) < 0.2',
  gnarledOak: '(0.5+sin(atan2(x,z)*8)*0.2)*(sqrt(x*x+z*z)/0.5)^(-2)-1.2 < y',
  // Also writes the material channel, so it pays for a slot store per voxel.
  rainbowTorus: 'data=(32+15/2/pi*atan2(x,y))%16; (0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2',
}

describe(`${SIZE}³ = ${(SIZE ** 3).toLocaleString('en-GB')} evaluations`, () => {
  for (const [name, source] of Object.entries(SHAPES)) {
    const result = compileExpression(source)
    if (!result.ok) throw new Error(`${name} did not compile`)
    const { expression } = result
    bench(name, () => {
      evaluateGrid(expression, SIZE)
    })
  }
})

describe('compilation, which happens once per edit rather than once per voxel', () => {
  for (const [name, source] of Object.entries(SHAPES)) {
    bench(name, () => {
      compileExpression(source)
    })
  }
})
