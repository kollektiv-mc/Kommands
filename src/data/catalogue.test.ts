import { describe, expect, test } from 'vitest'
import { catalogueList, embeddableIn, loadCatalogue } from './catalogue'
import { authoredCommands } from './authored/commands'
import { loadCommands } from './loadGenerated'
import { v1_21_1 } from './versions/1.21.1'
import { definitionProblems } from '../schema/invariants'
import { lookupArgumentType } from '../schema/argument-types'
import type { Node } from '../schema/types'

const catalogue = await loadCatalogue(v1_21_1)
const derived = await loadCommands(v1_21_1)

describe('the catalogue merges two sources into one kind of thing', () => {
  test('it holds every derived command and every authored one', () => {
    expect(Object.keys(catalogue)).toHaveLength(
      Object.keys(derived).length + Object.keys(authoredCommands).length,
    )
    expect(catalogue['vanilla:give']).toBeDefined()
    expect(catalogue['worldedit:generate']).toBeDefined()
  })

  test('the two dialects are told apart by a field, not by where they came from', () => {
    // The load-bearing claim: `//generate` needed no sibling subsystem. Both arrive as
    // CommandDefinitions and differ in two fields nothing downstream branches on.
    const give = catalogue['vanilla:give']!
    const generate = catalogue['worldedit:generate']!
    expect([give.dialect, give.provenance]).toEqual(['vanilla', 'derived'])
    expect([generate.dialect, generate.provenance]).toEqual(['worldedit', 'authored'])
    expect(Object.keys(give).sort()).toContain('root')
    expect(Object.keys(generate).sort()).toContain('root')
  })

  test('an authored definition keeps the presentation written beside it', () => {
    // withUi attaches metadata to *derived* definitions, which cannot hold their own.
    // An authored one already has it, and must not have it replaced.
    expect(catalogue['worldedit:generate']!.ui?.arguments?.pattern?.label).toBe('Blocks')
  })

  test('the list holds everything, in label order', () => {
    const list = catalogueList(catalogue)
    expect(list).toHaveLength(Object.keys(catalogue).length)
    const labels = list.map((d) => d.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  })
})

describe('what a @any Ref may embed', () => {
  // command-schema.md: '@any' means any command in the same *dialect* and version.
  // Not a formality — `/execute … run` hands its tail to the vanilla dispatcher, so
  // offering `//generate` there produced `/execute run //generate …`, which reads fine
  // and cannot run.
  test('a vanilla command may embed vanilla commands only', () => {
    const embeddable = embeddableIn(catalogue, catalogue['vanilla:execute']!)
    expect(embeddable['vanilla:give']).toBeDefined()
    expect(embeddable['worldedit:generate']).toBeUndefined()
    expect(Object.values(embeddable).every((d) => d.dialect === 'vanilla')).toBe(true)
  })

  test('a WorldEdit command may embed WorldEdit commands only', () => {
    const embeddable = embeddableIn(catalogue, catalogue['worldedit:generate']!)
    expect(Object.keys(embeddable)).toEqual(['worldedit:generate'])
  })

  test('a command may embed itself — the depth cap is what stops recursion, not this', () => {
    expect(embeddableIn(catalogue, catalogue['vanilla:execute']!)['vanilla:execute']).toBeDefined()
  })
})

describe('every definition in the catalogue is structurally sound', () => {
  test('no unreachable node follows a variadic argument', () => {
    // Invariant 6. Runs over all 79, so a future authored definition — or a deriver
    // change that moves a variadic argument — fails here rather than in the browser.
    expect(Object.values(catalogue).flatMap(definitionProblems)).toEqual([])
  })

  test('a variadic argument with anything after it is caught', () => {
    // The check proving itself, on a definition deliberately built wrong. Without this
    // the test above passes just as happily when definitionProblems returns nothing.
    const broken = {
      ...catalogue['worldedit:generate']!,
      root: {
        kind: 'sequence',
        nodes: [
          { kind: 'argument', name: 'expression', type: 'we_expression', variadic: true },
          { kind: 'literal', token: 'unreachable' },
        ],
      } satisfies Node,
    }
    expect(definitionProblems(broken)).toHaveLength(1)
    expect(definitionProblems(broken)[0]).toContain('can never be reached')
  })

  test('a variadic argument inside a Repeat is caught, because the next instance follows it', () => {
    const broken = {
      ...catalogue['worldedit:generate']!,
      root: {
        kind: 'repeat',
        node: { kind: 'argument', name: 'expression', type: 'we_expression', variadic: true },
      } satisfies Node,
    }
    expect(definitionProblems(broken)).toHaveLength(1)
  })

  test('every argument type named in the catalogue resolves to something renderable', () => {
    // Not that every one has a bespoke editor — most degrade to raw_text by design —
    // but that lookup never returns nothing, which would blank the page.
    const types = new Set<string>()
    const walk = (node: Node): void => {
      if (node.kind === 'argument') types.add(node.type)
      if ('nodes' in node) node.nodes.forEach(walk)
      if ('node' in node) walk(node.node)
    }
    Object.values(catalogue).forEach((d) => walk(d.root))
    for (const type of types) expect(lookupArgumentType(type).editor).toBeDefined()
  })
})
