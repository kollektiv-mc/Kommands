import { describe, expect, test } from 'vitest'
import type { Node, UiMetadata } from './types'
import {
  argumentPresentation,
  branchLabel,
  chainTail,
  choiceControl,
  choiceLabel,
} from './presentation'

const lit = (token: string): Node => ({ kind: 'literal', token })
const arg = (name: string, optional = false): Node => ({
  kind: 'argument',
  name,
  type: 'integer',
  optional,
})
const seq = (...nodes: Node[]): Node => ({ kind: 'sequence', nodes })

describe('argumentPresentation', () => {
  const ui: UiMetadata = {
    arguments: {
      'block/scale': { label: 'Block scale' },
      'entity/scale': { label: 'Entity scale' },
      targets: { label: 'Recipients' },
    },
  }
  const scale = arg('scale') as Extract<Node, { kind: 'argument' }>

  test('a bare name is found directly', () => {
    const targets = arg('targets') as Extract<Node, { kind: 'argument' }>
    expect(argumentPresentation(ui, targets, ['give'])?.label).toBe('Recipients')
  })

  test('a selector tells two same-named arguments apart by the keywords above them', () => {
    expect(argumentPresentation(ui, scale, ['store', 'result', 'block'])?.label).toBe('Block scale')
    expect(argumentPresentation(ui, scale, ['store', 'result', 'entity'])?.label).toBe(
      'Entity scale',
    )
    expect(argumentPresentation(ui, scale, ['store', 'result', 'storage'])).toBeUndefined()
  })
})

describe('branchLabel', () => {
  test('a keyword-led branch is called by its keyword', () => {
    expect(branchLabel(seq(lit('give'), arg('targets')), 1)).toBe('give')
    expect(branchLabel(lit('force'), 0)).toBe('force')
  })

  test('an argument-led branch is called by the argument, not by its position', () => {
    expect(branchLabel(seq(arg('seconds', true), arg('amplifier', true)), 1)).toBe('seconds')
    expect(branchLabel(arg('location'), 1)).toBe('location')
  })

  test('an authored label names an argument-led branch', () => {
    const ui: UiMetadata = { arguments: { seconds: { label: 'Duration' } } }
    expect(branchLabel(seq(arg('seconds', true)), 1, ui)).toBe('duration')
  })
})

describe('choiceLabel', () => {
  const choice = (optional: boolean, ...nodes: Node[]) =>
    ({ kind: 'choice', optional, nodes }) as Extract<Node, { kind: 'choice' }>

  test('names a row by what kind of choice it is', () => {
    expect(choiceLabel(choice(false, seq(lit('clear')), seq(lit('give'))), false)).toBe('Action')
    expect(choiceLabel(choice(false, arg('destination'), seq(lit('x'))), false)).toBe('Form')
    expect(choiceLabel(choice(true, lit('force'), lit('normal')), false)).toBe('Continue with')
    expect(choiceLabel(choice(false, lit('as')), true)).toBe('Clause')
  })
})

describe('choiceControl', () => {
  test('few short options sit side by side, anything else is a list', () => {
    expect(choiceControl(['clear', 'give'])).toBe('segmented')
    expect(choiceControl(['none', 'infinite', 'seconds'])).toBe('segmented')
    expect(choiceControl(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('listbox')
    expect(choiceControl(['clear', 'a_rather_long_label'])).toBe('listbox')
  })
})

describe('chainTail', () => {
  const repeat: Node = { kind: 'repeat', node: lit('as') }
  const run = (optional: boolean, branches = 1): Node => ({
    kind: 'choice',
    optional,
    nodes: Array.from({ length: branches }, (): Node => ({
      kind: 'sequence',
      nodes: [lit('run')],
    })),
  })

  test("finds a Repeat followed by an optional one-branch Choice: /execute's shape", () => {
    expect(chainTail([lit('execute'), repeat, run(true)])).toBe(1)
  })

  test('a required Choice, or one of several branches, is not an ending', () => {
    expect(chainTail([repeat, run(false)])).toBe(-1)
    expect(chainTail([repeat, run(true, 2)])).toBe(-1)
    expect(chainTail([repeat])).toBe(-1)
  })
})
