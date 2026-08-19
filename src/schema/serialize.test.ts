import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { SerializeContext, VersionTraits } from '../data/versions/types'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { EXECUTE, GENERATE } from './fixtures'
import { NO_REGISTRIES } from '../data/versions/registry'
import type { CommandDefinition } from './types'
import { serializeCommand, type CommandValue } from './serialize'
import { evaluateConstraints } from './constraints'
import { serializeTextComponent, textComponentField } from './text-component'
import { writeSnbt } from './snbt'

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
/** The derived skeleton, so a Ref resolves to the real thing rather than a stand-in. */
const GIVE = commands['vanilla:give']!

const ctxFor = (traits: VersionTraits): SerializeContext => ({ traits, registries: NO_REGISTRIES })
const ctx = ctxFor(v1_21_1.traits)

const value = (over: Partial<CommandValue> = {}): CommandValue => ({
  args: {},
  flags: {},
  choices: {},
  repeats: {},
  refs: {},
  ...over,
})

describe('a sequence, and what an unfilled argument does to it', () => {
  // A local definition rather than a real command: what is under test is the walk,
  // and /give's own output is asserted byte-for-byte against the canonical fixtures
  // in argument-types/item-stack.test.ts, using the derived skeleton.
  const SEQ: CommandDefinition = {
    id: 'vanilla:seq',
    label: '/seq',
    dialect: 'vanilla',
    provenance: 'authored',
    versions: { min: '1.21.1' },
    root: {
      kind: 'sequence',
      nodes: [
        { kind: 'literal', token: 'seq' },
        {
          kind: 'argument',
          name: 'who',
          type: 'entity_selector',
          typeOptions: { type: 'players' },
        },
        { kind: 'argument', name: 'note', type: 'string' },
        {
          kind: 'argument',
          name: 'count',
          type: 'integer',
          typeOptions: { min: 1 },
          optional: true,
        },
      ],
    },
  }

  test('serializes every filled argument in order', () => {
    const out = serializeCommand(SEQ, value({ args: { '/1': '@p', '/2': 'hello', '/3': 1 } }), ctx)
    expect(out).toBe('/seq @p hello 1')
  })

  test('an unfilled optional tail disappears rather than trailing a space', () => {
    const out = serializeCommand(SEQ, value({ args: { '/1': '@a', '/2': 'hello' } }), ctx)
    expect(out).toBe('/seq @a hello')
  })

  test('a deep type with no editor still degrades to a text field', () => {
    // The documented degradation, and the reason a command with an unimplemented deep
    // type still generates. nbt_path stands in for the 151 arguments still there.
    const withPath: CommandDefinition = {
      ...SEQ,
      root: {
        kind: 'sequence',
        nodes: [
          { kind: 'literal', token: 'seq' },
          { kind: 'argument', name: 'path', type: 'nbt_path' },
        ],
      },
    }
    expect(serializeCommand(withPath, value({ args: { '/1': 'Inventory[0].id' } }), ctx)).toBe(
      '/seq Inventory[0].id',
    )
  })
})

describe('serializers branch on traits, never on a version', () => {
  const component = { text: 'Server restarting', color: 'red', bold: true }

  test('as a command argument, 1.21.1 emits bare JSON', () => {
    // The canonical /tellraw fixture in docs/minecraft-versions.md. No surrounding
    // quotes: the argument is a component, not a string that contains one.
    expect(serializeTextComponent(component, ctx)).toBe(
      '{"text":"Server restarting","color":"red","bold":true}',
    )
  })

  test('as a data-component field, the same value is a quoted string', () => {
    // The distinction that produces a command which parses and does nothing if it is
    // got wrong. custom_name is `#[until="1.21.5"] #[text_component] string`, so
    // before 1.21.5 the field holds a *string* whose contents are the JSON.
    expect(writeSnbt(textComponentField(component, ctx))).toBe(
      '\'{"text":"Server restarting","color":"red","bold":true}\'',
    )
  })

  test('a quote or backslash in the text is escaped for the string it is wrapped in', () => {
    const awkward = { text: "it's a \\ backslash" }
    expect(writeSnbt(textComponentField(awkward, ctx))).toBe(
      '\'{"text":"it\\\'s a \\\\\\\\ backslash"}\'',
    )
  })

  test('flipping only the trait switches both forms to SNBT', () => {
    // Nothing here names a version. The same value and the same functions produce the
    // 1.21.5 form because one flag changed — which is the whole claim the trait model
    // makes, tested before 1.21.5 exists as a version. The field form loses its quotes
    // because from 1.21.5 the field holds the component itself.
    const future = ctxFor({ ...v1_21_1.traits, textComponentFormat: 'snbt' })
    expect(serializeTextComponent(component, future)).toBe(
      '{text:"Server restarting",color:"red",bold:true}',
    )
    expect(writeSnbt(textComponentField(component, future))).toBe(
      '{text:"Server restarting",color:"red",bold:true}',
    )
  })

  test('a SerializeContext carries no version id to compare against', () => {
    expect(Object.keys(ctx).sort()).toEqual(['registries', 'traits'])
  })
})

describe('the /tellraw canonical fixture', () => {
  test('a message is written bare, not as a quoted string', () => {
    // docs/minecraft-versions.md § Canonical 1.21.1 output. /tellraw's editor is #8's
    // work, but the argument type and its serializer landed with #7 — so the fixture
    // is assertable now, and asserting it is what keeps the argument form and the
    // data-component form from being confused for each other later.
    const TELLRAW = commands['vanilla:tellraw']!
    const out = serializeCommand(
      TELLRAW,
      value({
        args: {
          '/1': '@a',
          '/2': { text: 'Server restarting', color: 'red', bold: true },
        },
      }),
      ctx,
    )
    expect(out).toBe('/tellraw @a {"text":"Server restarting","color":"red","bold":true}')
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
        args: {
          '/1/#0/|0/1': '@a',
          '/2/1/1': '@s',
          '/2/1/2': { id: 'stone', components: {} },
        },
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
    const cyclic: CommandDefinition = {
      id: 'vanilla:loop',
      label: '/loop',
      dialect: 'vanilla',
      provenance: 'authored',
      versions: { min: '1.21.1' },
      root: {
        kind: 'sequence',
        nodes: [
          { kind: 'literal', token: 'loop' },
          { kind: 'ref', definitionId: 'vanilla:loop' },
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
