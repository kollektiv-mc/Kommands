import { expect, test } from 'vitest'
import { fingerprintOf } from './fingerprint'
import { EXECUTE } from './fixtures'
import type { CommandDefinition, Node } from './types'

/** The fixture, with one thing changed. Everything else stays identical. */
function variant(edit: (definition: CommandDefinition) => CommandDefinition): string {
  return fingerprintOf(edit(structuredClone(EXECUTE)))
}

const BASE = fingerprintOf(EXECUTE)

/** `/execute`'s Repeat, which every structural test below reaches through. */
function repeatOf(definition: CommandDefinition) {
  const root = definition.root as Extract<Node, { kind: 'sequence' }>
  return root.nodes[1] as Extract<Node, { kind: 'repeat' }>
}

test('the same definition always fingerprints the same', () => {
  // Not a tautology: `describe` walks arrays and reads optional fields, so an
  // accidental dependence on iteration order or on an undefined coalescing to
  // something unstable would show up here first.
  expect(fingerprintOf(EXECUTE)).toBe(BASE)
  expect(fingerprintOf(structuredClone(EXECUTE))).toBe(BASE)
})

test('the fingerprint is fixed-width hex, whatever the definition', () => {
  // Stored on every saved command, so its size is a persisted-format property rather
  // than an implementation detail.
  expect(BASE).toMatch(/^[0-9a-f]{16}$/)
})

// ── It MUST move for anything that relocates a path or changes what a value means ──

test('reordering a Choice moves it', () => {
  // The canonical case from persistence.md. `branch(parent, index)` indexes this
  // array, so a stored selection of 0 silently becomes a different clause.
  const moved = variant((d) => {
    const choice = repeatOf(d).node as Extract<Node, { kind: 'choice' }>
    choice.nodes.reverse()
    return d
  })
  expect(moved).not.toBe(BASE)
})

test('renaming an argument moves it', () => {
  const moved = variant((d) => {
    const choice = repeatOf(d).node as Extract<Node, { kind: 'choice' }>
    const clause = choice.nodes[0] as Extract<Node, { kind: 'sequence' }>
    const arg = clause.nodes[1] as Extract<Node, { kind: 'argument' }>
    arg.name = 'renamed'
    return d
  })
  expect(moved).not.toBe(BASE)
})

test('changing an argument type moves it', () => {
  // A retype leaves every path exactly where it was, which is what makes it the
  // dangerous one: the tree still fits, and every value in it means something else.
  const moved = variant((d) => {
    const choice = repeatOf(d).node as Extract<Node, { kind: 'choice' }>
    const clause = choice.nodes[0] as Extract<Node, { kind: 'sequence' }>
    const arg = clause.nodes[1] as Extract<Node, { kind: 'argument' }>
    arg.type = 'integer'
    return d
  })
  expect(moved).not.toBe(BASE)
})

test("changing a Repeat's min moves it", () => {
  // Beyond persistence.md's table, and the reason is mechanical: seedInstances(min)
  // mints `seed:0`, `seed:1`, … path segments for an untouched Repeat.
  const moved = variant((d) => {
    repeatOf(d).min = 1
    return d
  })
  expect(moved).not.toBe(BASE)
})

test("flipping a Choice's optional moves it", () => {
  // Also beyond the table. choiceSelection resolves an absent selection to NO_BRANCH
  // when optional and to branch 0 when not — so this changes which branch a tree with
  // no stored selection applies, without touching a stored byte.
  const moved = variant((d) => {
    const root = d.root as Extract<Node, { kind: 'sequence' }>
    const tail = root.nodes[2] as Extract<Node, { kind: 'choice' }>
    tail.optional = !tail.optional
    return d
  })
  expect(moved).not.toBe(BASE)
})

test('changing a literal token moves it', () => {
  const moved = variant((d) => {
    const root = d.root as Extract<Node, { kind: 'sequence' }>
    const literal = root.nodes[0] as Extract<Node, { kind: 'literal' }>
    literal.token = 'exec'
    return d
  })
  expect(moved).not.toBe(BASE)
})

test('repointing a Ref moves it', () => {
  const moved = variant((d) => {
    const tail = (d.root as Extract<Node, { kind: 'sequence' }>).nodes[2]
    const clause = (tail as Extract<Node, { kind: 'choice' }>).nodes[0]
    const ref = (clause as Extract<Node, { kind: 'sequence' }>).nodes[1] as Extract<
      Node,
      { kind: 'ref' }
    >
    ref.definitionId = 'vanilla:give'
    return d
  })
  expect(moved).not.toBe(BASE)
})

// ── It MUST NOT move for anything a reader only displays ──────────────────────

test('relabelling does not move it', () => {
  // The other half, and the half that makes it a tripwire rather than a nuisance. A
  // fingerprint that moved for presentation would orphan every save on a typo fix.
  expect(variant((d) => ({ ...d, label: 'Execute (renamed)' }))).toBe(BASE)
})

test('adding or changing aliases does not move it', () => {
  expect(variant((d) => ({ ...d, aliases: ['exec', 'ex'] }))).toBe(BASE)
})

test('presentation metadata does not move it', () => {
  expect(
    variant((d) => ({
      ...d,
      ui: {
        summary: 'Run a command as another entity.',
        arguments: { as_targets: { label: 'As' } },
      },
    })),
  ).toBe(BASE)
})

test('constraint messages do not move it', () => {
  expect(
    variant((d) => ({
      ...d,
      constraints: [{ kind: 'mutex', targets: ['as/as_targets'], message: 'reworded' }],
    })),
  ).toBe(BASE)
})

test('typeOptions do not move it', () => {
  // The closest call, and argued in fingerprint.ts: narrowing a bound can invalidate a
  // stored value, but the argument's own validator warns about that without blocking.
  // Moving the fingerprint would orphan saves the validator handles correctly.
  const same = variant((d) => {
    const choice = repeatOf(d).node as Extract<Node, { kind: 'choice' }>
    const clause = choice.nodes[0] as Extract<Node, { kind: 'sequence' }>
    const arg = clause.nodes[1] as Extract<Node, { kind: 'argument' }>
    arg.typeOptions = { ...arg.typeOptions, amount: 'single' }
    return d
  })
  expect(same).toBe(BASE)
})

test('adjacent free-text values cannot blur into each other', () => {
  // The separator's reason for existing, and it has to be tested where free text sits
  // next to free text. Most of the walk interleaves node kinds and arities, which act
  // as delimiters by accident — an earlier version of this test used two literals and
  // passed with the separator removed, which made it no test at all.
  //
  // A flagset is the honest case: `describe` pushes the arity and then the flag names
  // straight onto each other, so ['ab', 'c'] and ['a', 'bc'] both join to "flagset2abc"
  // without a delimiter. Two different definitions, one fingerprint.
  const flagged = (names: string[]): CommandDefinition => ({
    id: 'x',
    label: 'x',
    dialect: 'worldedit',
    provenance: 'authored',
    versions: { min: '1.21.1' },
    root: {
      kind: 'flagset',
      flags: names.map((name) => ({ name, char: name[0]!, label: name })),
    },
  })

  expect(fingerprintOf(flagged(['ab', 'c']))).not.toBe(fingerprintOf(flagged(['a', 'bc'])))
})
