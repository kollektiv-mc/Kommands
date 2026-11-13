import { describe, expect, it } from 'vitest'
import { EMPTY_VALUE } from './serialize'
import { busiestSizes, tilesFor } from './tiles'
import type { CommandDefinition, Node } from './types'

const arg = (name: string, type = 'entity_selector'): Node => ({
  kind: 'argument',
  name,
  type: type as never,
})
const word = (token: string): Node => ({ kind: 'literal', token })

const define = (root: Node, extra: Partial<CommandDefinition> = {}): CommandDefinition => ({
  id: 'test:cmd',
  label: '/cmd',
  dialect: 'vanilla',
  provenance: 'authored',
  versions: {} as never,
  root,
  ...extra,
})

// Two keyword-led branches, the second with two arguments under it.
const branching = define({
  kind: 'sequence',
  nodes: [
    word('cmd'),
    arg('who'),
    {
      kind: 'choice',
      nodes: [
        { kind: 'sequence', nodes: [word('a'), arg('one')] },
        { kind: 'sequence', nodes: [word('b'), arg('two'), arg('three')] },
      ],
    },
  ],
})

const kinds = (entries: ReturnType<typeof tilesFor>) => entries.map((e) => e.kind)

describe('tilesFor', () => {
  it('draws no tile for a keyword', () => {
    expect(kinds(tilesFor(define(word('cmd')), EMPTY_VALUE))).toEqual([])
  })

  it('follows the branch the value picked', () => {
    const first = tilesFor(branching, EMPTY_VALUE)
    expect(kinds(first)).toEqual(['argument', 'choice', 'argument'])
    const second = tilesFor(branching, { ...EMPTY_VALUE, choices: { '/2': 1 } })
    expect(second.map((e) => e.key)).toEqual(['/1', '/2', '/2/|1/1', '/2/|1/2'])
  })

  it('records the keywords above a tile', () => {
    const second = tilesFor(branching, { ...EMPTY_VALUE, choices: { '/2': 1 } })
    expect(second.at(-1)?.literals).toEqual(['cmd', 'b'])
  })

  it('ends with a filling preview when one is bound', () => {
    const entries = tilesFor(define(arg('who'), { preview: {} as never }), EMPTY_VALUE)
    expect(entries.at(-1)).toMatchObject({ kind: 'preview', size: 'fill' })
  })

  it('marks a message tile wide', () => {
    const [entry] = tilesFor(define(arg('message', 'text_component')), EMPTY_VALUE)
    expect(entry).toMatchObject({ wide: true })
  })
})

describe('busiestSizes', () => {
  it('measures the branch with the most rows', () => {
    // who, the picker, then branch b's two arguments.
    expect(busiestSizes(branching)).toEqual([2, 2, 2, 2])
  })

  it('leaves a wide tile out, since it takes a band below', () => {
    const def = define({ kind: 'sequence', nodes: [arg('who'), arg('msg', 'text_component')] })
    expect(busiestSizes(def)).toEqual([2])
  })
})
