import { bench, describe } from 'vitest'
import { evaluateGrid } from '../expression'
import { compileProgram } from '../expression/compile'
import { compileTree } from './compile'
import { simplify } from './simplify'
import { SCULPTS } from './sculpts'

/**
 * What the compiler costs, and what it costs the evaluator.
 *
 * Two different questions, and the second is the one that matters. Compiling happens
 * once per edit over a graph with tens of nodes; evaluating happens 262,144 times per
 * edit at 64³, which is the figure `docs/health-checklist.md` § 4 sets the preview budget
 * against. So a compiler that emits a badly-shaped expression shows up in the second
 * block rather than the first — and the point of benching both is to be able to tell
 * those apart.
 */

const SIZE = 64

describe('compiling a graph', () => {
  for (const sculpt of SCULPTS) {
    bench(sculpt.name, () => {
      compileTree(sculpt.tree())
    })
  }

  bench('simplify then compile, twenty operations', () => {
    compileTree(simplify(SCULPTS[SCULPTS.length - 1]!.tree()))
  })
})

describe('evaluating what it emitted, over a 64³ region', () => {
  for (const sculpt of SCULPTS) {
    const { program } = compileTree(sculpt.tree())
    const { expression } = compileProgram(program)
    bench(sculpt.name, () => {
      evaluateGrid(expression, SIZE)
    })
  }
})
