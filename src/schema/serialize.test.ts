import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { SerializeContext, VersionTraits } from '../data/versions/types'
import { EXECUTE, GENERATE, GIVE } from './fixtures'
import { serializeCommand, type CommandValue } from './serialize'
import { evaluateConstraints } from './constraints'
import { serializeTextComponent } from './text-component'

const noRegistries = { entries: () => [], has: () => true }
const ctxFor = (traits: VersionTraits): SerializeContext => ({ traits, registries: noRegistries })
const ctx = ctxFor(v1_21_1.traits)

const value = (over: Partial<CommandValue> = {}): CommandValue => ({
  args: {},
  flags: {},
  choices: {},
  repeats: {},
  refs: {},
  ...over,
})

describe('/give — the shallow spine, end to end', () => {
  // Paths, not names: '' is the root sequence, /1 its second child. See paths.ts for
  // why values are keyed this way rather than by argument name.
  const targets = '/1'
  const item = '/2'
  const count = '/3'

  test('serializes every filled argument in order', () => {
    const out = serializeCommand(
      GIVE,
      value({ args: { [targets]: '@p', [item]: 'minecraft:netherite_sword', [count]: 1 } }),
      ctx,
    )
    expect(out).toBe('/give @p minecraft:netherite_sword 1')
  })

  test('an unfilled optional tail disappears rather than trailing a space', () => {
    const out = serializeCommand(
      GIVE,
      value({ args: { [targets]: '@a', [item]: 'minecraft:stone' } }),
      ctx,
    )
    expect(out).toBe('/give @a minecraft:stone')
  })

  test('item_stack degrades to raw_text until #7, rather than breaking', () => {
    // The parser table marks item_stack `deep`; no editor is registered for it yet, so
    // the registry hands back the raw_text fallback. The documented degradation, and
    // the reason a command with an unimplemented deep type still generates.
    const out = serializeCommand(
      GIVE,
      value({ args: { [targets]: '@s', [item]: 'minecraft:stone[custom_name=x]' } }),
      ctx,
    )
    expect(out).toBe('/give @s minecraft:stone[custom_name=x]')
  })
})

describe('serializers branch on traits, never on a version', () => {
  const component = { text: 'Server restarting', color: 'red', bold: true }

  test('1.21.1 emits a quoted JSON string', () => {
    expect(serializeTextComponent(component, ctx)).toBe(
      '\'{"text":"Server restarting","color":"red","bold":true}\'',
    )
  })

  test('flipping only the trait switches the form to SNBT', () => {
    // Nothing here names a version. The same value and the same function produce the
    // 1.21.5 form because one flag changed — which is the whole claim the trait model
    // makes, tested before 1.21.5 exists as a version.
    const future = ctxFor({ ...v1_21_1.traits, textComponentFormat: 'snbt' })
    expect(serializeTextComponent(component, future)).toBe(
      '{text:"Server restarting",color:"red",bold:true}',
    )
  })

  test('a SerializeContext carries no version id to compare against', () => {
    expect(Object.keys(ctx).sort()).toEqual(['registries', 'traits'])
  })
})

describe('/execute — the case that decides whether the tree was necessary', () => {
  test('renders a chain of clauses without any per-command handling', () => {
    const out = serializeCommand(
      EXECUTE,
      value({
        repeats: { '/1': 2 },
        choices: { '/1/#0': 0, '/1/#1': 1 },
        args: { '/1/#0/|0/1': '@a', '/1/#1/|1/1': '@s' },
      }),
      ctx,
    )
    expect(out).toBe('/execute as @a at @s run')
  })

  test('a Ref resolves through the same walk', () => {
    const out = serializeCommand(
      EXECUTE,
      value({
        repeats: { '/1': 1 },
        choices: { '/1/#0': 0 },
        args: { '/1/#0/|0/1': '@a', '/2/1/1': '@s', '/2/1/2': 'minecraft:stone' },
        refs: { '/2/1': 'vanilla:give' },
      }),
      ctx,
      { resolve: (id) => (id === GIVE.id ? GIVE : undefined) },
    )
    expect(out).toBe('/execute as @a run give @s minecraft:stone')
  })

  test('a Ref cycle terminates instead of hanging the tab', () => {
    // command-schema.md forbids a Ref that reaches itself without passing a Repeat,
    // but a definition is data and data can be wrong. The cap turns a frozen tab into
    // truncated output — a bug report someone can act on.
    const cyclic = {
      ...GIVE,
      root: {
        kind: 'sequence' as const,
        nodes: [
          { kind: 'literal' as const, token: 'loop' },
          { kind: 'ref' as const, definitionId: 'vanilla:give' },
        ],
      },
    }
    const out = serializeCommand(cyclic, value({}), ctx, {
      resolve: () => cyclic,
      maxDepth: 4,
    })
    expect(out).toBe('/loop loop loop loop')
  })
})

describe('//generate — flags, variadic tail, mutex', () => {
  test('flags serialise as one combined token', () => {
    const out = serializeCommand(
      GENERATE,
      value({
        flags: { '/1/-h': true, '/1/-r': true },
        args: { '/2': '50%stone,50%dirt', '/3': 'x^2+y^2+z^2 < 1' },
      }),
      ctx,
    )
    expect(out).toBe('//generate -hr 50%stone,50%dirt x^2+y^2+z^2 < 1')
  })

  test('a violated mutex warns and still produces output', () => {
    const v = value({ flags: { '/1/-r': true, '/1/-o': true } })
    const diagnostics = evaluateConstraints(GENERATE, v)
    expect(diagnostics).toEqual([{ severity: 'warning', message: 'Choose one origin mode.' }])
    // The point of "warns, never blocks": the command is still generated.
    expect(serializeCommand(GENERATE, v, ctx)).toBe('//generate -ro')
  })

  test('one origin mode is not a violation', () => {
    expect(evaluateConstraints(GENERATE, value({ flags: { '/1/-o': true } }))).toEqual([])
  })
})
