import { describe, expect, test } from 'vitest'
import { loadCatalogue } from '../data/catalogue'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { CommandDefinition, Node } from '../schema/types'
import { hasArgument, hasFlag, previewProblems } from './binding'
import { previewModule, registeredPreviewIds } from './registry'
import type { PreviewModule } from './types'

/**
 * The types half of build-time binding validation.
 *
 * `src/data/catalogue.test.ts` runs invariants 6 and 7 over the whole catalogue — the
 * *names* half, which proves each `inputs` selector resolves to exactly one node. This
 * is the other half `docs/adding-a-preview.md` asks for: whether that node holds the
 * kind of value the module actually reads.
 *
 * Both halves are needed and neither implies the other. A rename is caught by invariant
 * 7; a retype is invisible to it, and would render an empty canvas in production.
 */

const catalogue = await loadCatalogue(v1_21_1)
const generate = catalogue['worldedit:generate']!

/** `//generate` with one argument's type changed, leaving every name in place. */
function retyped(name: string, type: string): CommandDefinition {
  const root = structuredClone(generate.root) as Extract<Node, { kind: 'sequence' }>
  for (const node of root.nodes) {
    if (node.kind === 'argument' && node.name === name) node.type = type
  }
  return { ...generate, root }
}

describe('every preview binding in the catalogue is sound', () => {
  test('nothing in the catalogue names a missing module or a type its module rejects', () => {
    // Over all 79, so a deriver change that reshapes an argument a module reads fails
    // here rather than in a browser. The negative controls below prove each half.
    expect(Object.values(catalogue).flatMap((d) => previewProblems(d))).toEqual([])
  })

  test('at least one definition actually declares a preview', () => {
    // Without this the test above passes just as happily when nothing is bound at all,
    // which is exactly how it looked before this change.
    const bound = Object.values(catalogue).filter((d) => d.preview !== undefined)
    expect(bound.map((d) => d.id)).toContain('worldedit:generate')
  })

  test('a module named by a definition is one the registry holds', () => {
    expect(previewModule('worldedit/shape')).toBeDefined()
    expect(registeredPreviewIds()).toContain('worldedit/shape')
  })
})

describe('a broken binding is caught rather than drawn empty', () => {
  test('a module id nothing registers is reported, with what was available', () => {
    const typo = { ...generate, preview: { module: 'worldedit/shpae', inputs: ['expression'] } }
    const [problem, ...rest] = previewProblems(typo)
    expect(rest).toEqual([])
    expect(problem).toContain('not ')
    expect(problem).toContain('worldedit/shape')
  })

  test('an argument re-typed under a module is reported, though its name is unchanged', () => {
    // The failure invariant 7 structurally cannot see: every selector still resolves to
    // exactly one node, and that node no longer holds an expression.
    const problems = previewProblems(retyped('expression', 'raw_text'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('does not accept')
  })

  test('the same is true of the other argument the module reads', () => {
    expect(previewProblems(retyped('pattern', 'string'))).toHaveLength(1)
  })

  test('a module is free to reject a definition, and the check reports it either way', () => {
    const always: PreviewModule = {
      id: 'test/never',
      load: () => Promise.reject(new Error('never loaded')),
      accepts: () => false,
    }
    const bound = { ...generate, preview: { module: 'test/never', inputs: ['expression'] } }
    expect(previewProblems(bound, (id) => (id === 'test/never' ? always : undefined))).toHaveLength(
      1,
    )
  })

  test('a definition with no preview has nothing to report', () => {
    expect(previewProblems(catalogue['vanilla:give']!)).toEqual([])
  })
})

describe('hasArgument asserts one node, of one type', () => {
  test('it holds for the argument it was written for', () => {
    expect(hasArgument(generate, 'expression', 'we_expression')).toBe(true)
    expect(hasFlag(generate, '-h')).toBe(true)
  })

  test('a name that is right and a type that is wrong is false', () => {
    expect(hasArgument(generate, 'expression', 'we_pattern')).toBe(false)
  })

  test('a name nothing has is false rather than throwing', () => {
    expect(hasArgument(generate, 'nonexistent', 'we_expression')).toBe(false)
    expect(hasFlag(generate, '-zzz')).toBe(false)
  })

  test('an ambiguous name is false, because "one node" is part of the assertion', () => {
    // /execute has 36 arguments called `scale`. A module bound to that name would be
    // bound to none of them in particular.
    expect(hasArgument(catalogue['vanilla:execute']!, 'scale', 'double')).toBe(false)
  })

  test('a flag is not an argument, and does not answer as one', () => {
    expect(hasArgument(generate, '-h', 'bool')).toBe(false)
  })
})
