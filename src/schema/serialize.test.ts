import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { SerializeContext, VersionTraits } from '../data/versions/types'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { EXECUTE } from './fixtures'
import { generate as GENERATE } from '../data/authored/commands/worldedit/generate'
import { NO_REGISTRIES } from '../data/versions/registry'
import type { CommandDefinition, Node } from './types'
import { aliasNames, serializeCommand, type CommandValue } from './serialize'
import { evaluateConstraints } from './constraints'
import { serializeTextComponent, textComponentField, type TextComponent } from './text-component'
import { writeSnbt } from './snbt'

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
/** The derived skeleton, so a Ref resolves to the real thing rather than a stand-in. */
const GIVE = commands['vanilla:give']!

/** A plain-text component. The content is a union, so even the simplest case names its kind. */
const plain = (text: string, rest: Partial<TextComponent> = {}): TextComponent => ({
  content: { kind: 'text', text },
  ...rest,
})

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
  const component = plain('Server restarting', { color: 'red', bold: true })

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
    const awkward = plain("it's a \\ backslash")
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
          '/2': plain('Server restarting', { color: 'red', bold: true }),
        },
      }),
      ctx,
    )
    expect(out).toBe('/tellraw @a {"text":"Server restarting","color":"red","bold":true}')
  })

  const tellraw = (message: TextComponent) =>
    serializeCommand(
      commands['vanilla:tellraw']!,
      value({ args: { '/1': '@a', '/2': message } }),
      ctx,
    )

  test('a child carrying both events', () => {
    expect(
      tellraw(
        plain('Reset ', {
          extra: [
            plain('here', {
              color: 'aqua',
              underlined: true,
              clickEvent: { action: 'run_command', value: '/spawn' },
              hoverEvent: { action: 'show_text', contents: plain('Teleports you') },
            }),
          ],
        }),
      ),
    ).toBe(
      '/tellraw @a {"text":"Reset ","extra":[{"text":"here","color":"aqua","underlined":true,' +
        '"clickEvent":{"action":"run_command","value":"/spawn"},' +
        '"hoverEvent":{"action":"show_text","contents":{"text":"Teleports you"}}}]}',
    )
  })

  test('a score, which has no text field at all', () => {
    expect(tellraw({ content: { kind: 'score', objective: 'kills', name: '@s' } })).toBe(
      '/tellraw @a {"score":{"objective":"kills","name":"@s"}}',
    )
  })
})

describe('/execute — the case that decides whether the tree was necessary', () => {
  test('renders a chain of clauses without any per-command handling', () => {
    // The `run` clause is optional and nothing selected it, so it contributes nothing —
    // no keyword, no trailing space. `/execute as @a at @s` is a complete command: every
    // if/unless leaf is executable, which is what makes the tail skippable at all.
    const out = serializeCommand(
      EXECUTE,
      value({
        repeats: { '/1': ['as', 'at'] },
        choices: { '/1/#as': 0, '/1/#at': 1 },
        args: { '/1/#as/|0/1': '@a', '/1/#at/|1/1': '@s' },
      }),
      ctx,
    )
    expect(out).toBe('/execute as @a at @s')
  })

  test('choosing the run clause without choosing a command leaves a visible gap', () => {
    // The inverse of the test above, and the reason a Ref carries no `optional` of its
    // own: once the clause is selected the command is required, so an unpicked one
    // reads as a gap rather than as a finished `/execute as @a run`.
    const out = serializeCommand(
      EXECUTE,
      value({
        repeats: { '/1': ['as'] },
        choices: { '/1/#as': 0, '/2': 0 },
        args: { '/1/#as/|0/1': '@a' },
      }),
      ctx,
    )
    expect(out).toBe('/execute as @a run <command>')
  })

  test('a Ref resolves through the same walk', () => {
    const out = serializeCommand(
      EXECUTE,
      value({
        repeats: { '/1': ['as'] },
        choices: { '/1/#as': 0, '/2': 0 },
        args: {
          '/1/#as/|0/1': '@a',
          '/2/|0/1/1': '@s',
          '/2/|0/1/2': { id: 'stone', components: {} },
        },
        refs: { '/2/|0/1': 'vanilla:give' },
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
  // The authored definition itself, not a transcription of it. `//generate` is the
  // first command with no derived skeleton behind it, so this file asserting the real
  // thing is the only way a change to it is caught.
  const pattern = (...entries: Array<[string, number | '']>) => ({
    entries: entries.map(([block, weight]) => ({ block, weight })),
  })

  test('flags serialise as one combined token', () => {
    const out = serializeCommand(
      GENERATE,
      value({
        flags: { '/1/-h': true, '/1/-r': true },
        args: {
          '/2': pattern(['stone', 50], ['dirt', 50]),
          '/3': 'x^2+y^2+z^2 < 1',
        },
      }),
      ctx,
    )
    expect(out).toBe('//generate -hr 50%stone,50%dirt x^2+y^2+z^2 < 1')
  })

  test('the expression keeps its spaces, which is what variadic buys it', () => {
    // WorldEdit takes the expression as List<String> and rejoins it with spaces, so
    // the tail is one argument however many tokens it looks like. Any node after it
    // would be tokens this one had already swallowed — asserted structurally in
    // fixtures, and visible here as an argument whose value simply contains spaces.
    const out = serializeCommand(
      GENERATE,
      value({
        args: { '/2': pattern(['stone', '']), '/3': '  y > sin(x * 8) * 0.2  ' },
      }),
      ctx,
    )
    expect(out).toBe('//generate stone y > sin(x * 8) * 0.2')
  })

  test('a single block is written bare, because a lone weight does not parse', () => {
    // WorldEdit's RandomPatternParser returns null for a one-token pattern and hands
    // it to the plain block parser, which does not understand `50%`. So a weight on a
    // single entry is not a preference, it is a parse error — dropped, and warned about.
    const single = value({ args: { '/2': pattern(['stone', 50]), '/3': 'y < 1' } })
    expect(serializeCommand(GENERATE, single, ctx)).toBe('//generate stone y < 1')
  })

  test('unweighted entries mix with weighted ones', () => {
    // An entry without a weight counts as 1 in WorldEdit, so mixing is legal and the
    // serializer must not invent a weight for the bare one.
    const out = serializeCommand(
      GENERATE,
      value({
        args: { '/2': pattern(['stone', 3], ['dirt', '']), '/3': 'y < 1' },
      }),
      ctx,
    )
    expect(out).toBe('//generate 3%stone,dirt y < 1')
  })

  test('a violated mutex warns and still produces output', () => {
    const v = value({ flags: { '/1/-r': true, '/1/-o': true } })
    const diagnostics = evaluateConstraints(GENERATE, v)
    expect(diagnostics).toEqual([
      {
        severity: 'warning',
        message: 'Only one origin mode applies. WorldEdit takes -r first, then -o, then -c.',
      },
    ])
    // The point of "warns, never blocks": the command is still generated.
    // The two required arguments show as placeholders rather than as nothing: this
    // command is incomplete, and the output says so instead of looking finished.
    expect(serializeCommand(GENERATE, v, ctx)).toBe('//generate -ro <pattern> <expression>')
  })

  test('one origin mode is not a violation', () => {
    expect(evaluateConstraints(GENERATE, value({ flags: { '/1/-o': true } }))).toEqual([])
  })

  test('the dialect decides the slashes, and it is the only thing that does', () => {
    // A vanilla command is a bare literal that serializeCommand prefixes with '/'; a
    // WorldEdit token carries its own. That is the whole of what `dialect` changes,
    // and the reason it is a field rather than a subsystem.
    expect(GENERATE.dialect).toBe('worldedit')
    expect(serializeCommand(GENERATE, value({}), ctx).startsWith('//generate')).toBe(true)
  })
})

describe('the canonical /execute fixture', () => {
  // docs/minecraft-versions.md § Canonical 1.21.1 output. Asserted against the
  // *derived* skeleton rather than the abridged fixture, so a deriver change that
  // reshapes /execute or /particle fails here too — and because the derived tree is
  // what the app actually renders.
  const EXECUTE_1_21_1 = commands['vanilla:execute']!
  const PARTICLE = commands['vanilla:particle']!

  test('/execute as @a at @s run particle …, byte for byte', () => {
    const out = serializeCommand(
      EXECUTE_1_21_1,
      value({
        // Named so that the list order and any order the *ids* suggest disagree: `z`
        // comes first. The expected string below is unchanged, which is the assertion —
        // clause order comes from the list, and an id says only which clause it is.
        repeats: { '/1': ['z', 'a'] },
        choices: { '/1/#z': 2, '/1/#a': 3, '/2': 0 },
        args: {
          '/1/#z/|2/1': '@a',
          '/1/#a/|3/1': '@s',
          '/2/|0/1/1': 'minecraft:flame',
          '/2/|0/1/2': '~ ~1 ~',
          '/2/|0/1/3': '0.2 0.2 0.2',
          '/2/|0/1/4': 0,
          '/2/|0/1/5': 10,
        },
        refs: { '/2/|0/1': 'vanilla:particle' },
      }),
      ctx,
      { resolve: (id) => commands[id] },
    )
    expect(out).toBe('/execute as @a at @s run particle minecraft:flame ~ ~1 ~ 0.2 0.2 0.2 0 10')
  })

  test('the two things that used to be appended to it', () => {
    // Regression, and the reason this fixture could not be asserted before. mcmeta
    // marks /particle's `count` executable, so `force|normal` is a tail the user may
    // skip — and `viewers` inside it is optional, so its editor must not seed one.
    const tail = (PARTICLE.root as Extract<Node, { kind: 'sequence' }>).nodes[6]
    expect(tail).toMatchObject({ kind: 'choice', optional: true })

    const bare = serializeCommand(
      PARTICLE,
      value({ args: { '/1': 'minecraft:flame', '/4': 0, '/5': 10 } }),
      ctx,
    )
    expect(bare).toBe('/particle minecraft:flame 0 10')
  })

  test('selecting the force clause does not conjure a viewer list', () => {
    // `viewers` is optional, so an untouched one contributes nothing. It used to
    // default to '@p' and put a viewer nobody chose into the command.
    const out = serializeCommand(
      PARTICLE,
      value({ args: { '/1': 'minecraft:flame', '/4': 0, '/5': 10 }, choices: { '/6': 0 } }),
      ctx,
    )
    expect(out).toBe('/particle minecraft:flame 0 10 force')
  })
})

describe('the dialect decides the slashes, everywhere and not just in the output', () => {
  test('a vanilla alias is bare in storage and slashed on screen', () => {
    // mcmeta stores them bare, so the prefix is applied on the way out.
    expect(aliasNames(commands['vanilla:experience']!)).toEqual(['/xp'])
  })

  test('a WorldEdit alias already carries its slashes and does not get another', () => {
    // The bug this pins: the command page prefixed every alias with '/', which is right
    // for a bare vanilla one and turned '//gen' into '///gen'.
    expect(aliasNames(GENERATE)).toEqual(['//gen', '//g'])
  })

  test('a command with no aliases lists none', () => {
    expect(aliasNames(commands['vanilla:give']!)).toEqual([])
  })
})
