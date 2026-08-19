import { describe, expect, test } from 'vitest'
import commandsPayload from './generated/1.21.1/commands.json'
import { PARSERS } from './authored/parsers'
import { hasArgumentType } from '../schema/argument-types'
import type { CommandDefinition, Node } from '../schema/types'

/**
 * Tests against the committed output, not against a fresh fetch.
 *
 * The committed files are the artefact everything downstream reads, and they are what
 * a reviewer sees in a version-bump diff. Re-deriving here would test the generator
 * twice and the artefact never — and would put the network on the critical path of
 * `pnpm test`.
 */

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node)
  switch (node.kind) {
    case 'sequence':
    case 'choice':
      node.nodes.forEach((n) => walk(n, visit))
      break
    case 'repeat':
      walk(node.node, visit)
      break
    default:
      break
  }
}

const allNodes = (definition: CommandDefinition): Node[] => {
  const out: Node[] = []
  walk(definition.root, (n) => out.push(n))
  return out
}

describe('the derived set', () => {
  test('is 78 commands and 5 aliases, not 83', () => {
    // 83 is the number of Brigadier root children. Five of them — tell, w, tm, tp, xp
    // — are depth-1 childless literals redirecting at another root command, which is
    // an alias rather than a command of its own.
    expect(Object.keys(commands)).toHaveLength(78)
    const aliases = Object.values(commands).flatMap((c) => c.aliases ?? [])
    expect(aliases.sort()).toEqual(['tell', 'tm', 'tp', 'w', 'xp'])
  })

  test('an alias lands on the command it aliases', () => {
    expect(commands['vanilla:msg']?.aliases).toEqual(['tell', 'w'])
    expect(commands['vanilla:teleport']?.aliases).toEqual(['tp'])
    expect(commands['vanilla:tell']).toBeUndefined()
  })

  test('carries a DO-NOT-EDIT header, since JSON has no comments', () => {
    expect(commandsPayload.$generated.doNotEdit).toMatch(/DO NOT EDIT/)
    expect(commandsPayload.$generated.source).toBe('misode/mcmeta@1.21.1-summary')
    expect(commandsPayload.$generated.regenerate).toBe('pnpm gen:commands')
  })

  test('every definition is stamped derived, for the version it was derived for', () => {
    for (const [id, definition] of Object.entries(commands)) {
      expect(definition.provenance, id).toBe('derived')
      expect(definition.dialect, id).toBe('vanilla')
      expect(definition.versions.min, id).toBe('1.21.1')
      expect(definition.id, id).toBe(id)
    }
  })
})

describe('/give matches the worked example', () => {
  // #4's stated acceptance: the derived skeleton matches docs/command-schema.md.
  // Transcribed from the doc rather than from the output, so this fails if either
  // one moves.
  test('exactly', () => {
    expect(commands['vanilla:give']?.root).toEqual({
      kind: 'sequence',
      nodes: [
        { kind: 'literal', token: 'give' },
        {
          kind: 'argument',
          name: 'targets',
          type: 'entity_selector',
          typeOptions: { type: 'players', amount: 'multiple' },
        },
        { kind: 'argument', name: 'item', type: 'item_stack' },
        {
          kind: 'argument',
          name: 'count',
          type: 'integer',
          typeOptions: { min: 1 },
          optional: true,
        },
      ],
    })
  })
})

describe('the mcmeta quirk', () => {
  // Redirect-to-root is serialised as a childless literal, so `run` arrives looking
  // empty. Without the special case /execute derives as a dead end — a definition
  // that looks valid and cannot express the command.
  const refsIn = (id: string) =>
    allNodes(commands[id]!).filter((n): n is Extract<Node, { kind: 'ref' }> => n.kind === 'ref')

  test('/execute chains clauses and ends in a command reference', () => {
    const root = commands['vanilla:execute']!.root
    expect(root.kind).toBe('sequence')
    const kinds = (root as Extract<Node, { kind: 'sequence' }>).nodes.map((n) => n.kind)
    expect(kinds).toEqual(['literal', 'repeat', 'literal', 'ref'])
    expect(refsIn('vanilla:execute')[0]?.definitionId).toBe('@any')
  })

  test('/return has the same shape, and it is found by shape not by name', () => {
    // The docs only ever mention /execute. Matching on the name `run`, or on the
    // command being `execute`, would have missed this one.
    expect(refsIn('vanilla:return')).toHaveLength(1)
  })

  test('and nothing else in the tree grew a stray reference', () => {
    const withRefs = Object.keys(commands).filter((id) => refsIn(id).length > 0)
    expect(withRefs.sort()).toEqual(['vanilla:execute', 'vanilla:return'])
  })
})

describe('argument types', () => {
  const argumentNodes = Object.entries(commands).flatMap(([id, d]) =>
    allNodes(d)
      .filter((n): n is Extract<Node, { kind: 'argument' }> => n.kind === 'argument')
      .map((n) => ({ id, node: n })),
  )

  test('every argument names a type the parser table can produce', () => {
    // The cross-check src/data/authored/parsers.test.ts could not do before the tree
    // was committed: nothing may appear in the output that the table did not put there.
    const fromTable = new Set(Object.values(PARSERS).map((b) => b.type))
    const strays = [...new Set(argumentNodes.filter(({ node }) => !fromTable.has(node.type)))]
    expect(strays.map((s) => `${s.id}:${s.node.name}=${s.node.type}`)).toEqual([])
  })

  test('the recorded gap is exactly the deep arguments', () => {
    // The deriver reports how many arguments fell back to raw_text. Asserting the
    // number here ties that report to the artefact: if an editor lands and the count
    // does not move, either the editor is not wired up or the gap was miscounted.
    //
    // Not asserted: that a *shallow* type has an editor. 34 of the 41 do not, and
    // that is fine — a scalar round-trips through a text field, which is why the
    // parser table calls them shallow. Only a deep type is a product gap.
    const deepTypes = new Set(
      Object.values(PARSERS)
        .filter((b) => b.kind === 'deep')
        .map((b) => b.type),
    )
    const deep = argumentNodes.filter(({ node }) => deepTypes.has(node.type))
    expect(deep).toHaveLength(183)

    // #7 registered item_stack (17 uses) and text_component (15). The split is
    // asserted rather than the total, so an editor landing has to move a number here:
    // that is the check that it was actually wired into the registry.
    const covered = deep.filter(({ node }) => hasArgumentType(node.type))
    expect(covered).toHaveLength(32)
    expect(new Set(covered.map(({ node }) => node.type))).toEqual(
      new Set(['item_stack', 'text_component']),
    )
    expect(deep.length - covered.length).toBe(151)
  })

  test('optional marks arguments the command may end before', () => {
    // /give's count is optional because item is executable; targets and item are not.
    const give = allNodes(commands['vanilla:give']!).filter((n) => n.kind === 'argument')
    expect(give.map((n) => Boolean((n as Extract<Node, { kind: 'argument' }>).optional))).toEqual([
      false,
      false,
      true,
    ])
  })
})
