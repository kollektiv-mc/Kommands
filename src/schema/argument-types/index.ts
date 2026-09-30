import type {
  ArgumentNode,
  ArgumentOptions,
  ArgumentType,
  ArgumentTypeKey,
  Diagnostic,
  ErasedArgumentType,
} from '../types'
import { NumberEditor } from '../../components/editors/NumberEditor'
import { ToggleEditor } from '../../components/editors/ToggleEditor'
import { TextEditor } from '../../components/editors/TextEditor'
import { SelectorEditor } from '../../components/editors/SelectorEditor'
import { ItemStackEditor } from '../../components/editors/ItemStackEditor'
import { TextComponentEditor } from '../../components/editors/TextComponentEditor'
import { PatternEditor } from '../../components/editors/PatternEditor'
import { ExpressionEditor } from '../../components/editors/ExpressionEditor'
import { coordinateEditor } from '../../components/editors/CoordinateEditor'
import { enumEditor } from '../../components/editors/EnumEditor'
import { ResourceEditor } from '../../components/editors/ResourceEditor'
import { SwizzleEditor } from '../../components/editors/SwizzleEditor'
import {
  ENTITY_ANCHORS,
  GAMEMODES,
  HEIGHTMAPS,
  SCOREBOARD_OPERATIONS,
  TEAM_COLORS,
  TEMPLATE_MIRRORS,
  TEMPLATE_ROTATIONS,
} from '../../data/authored/enums'
import { selectorsFor } from '../../data/authored/selectors'
import {
  emptyTextComponent,
  isEmptyTextComponent,
  serializeTextComponent,
  type TextComponent,
  validateTextComponent,
} from '../text-component'
import {
  serializeItemStack,
  validateItemStack,
  EMPTY_ITEM_STACK,
  type ItemStackValue,
} from './item-stack'
import { serializePattern, validatePattern, EMPTY_PATTERN, type PatternValue } from './we-pattern'
import { validateExpression } from './we-expression'
import { COORDINATE_SHAPES, coordinateProblems, serializeCoordinates } from '../coordinates'
import { enumControl } from '../presentation'
import { validateResource } from '../resource-location'

/**
 * The argument-type registry.
 *
 * Each entry supplies an editor, a serializer, a validator and a default. Serializers
 * take a SerializeContext and read traits from it; none of them can see a version id,
 * so a version-number comparison is not merely discouraged here — it is unavailable.
 *
 * Validators return warnings and never throw. Output always renders: an invalid
 * command is still shown, and the user decides. A validator that blocked would make
 * the generator refuse to generate, which is the one thing it must not do.
 */

/**
 * Register a type, erasing its value parameter.
 *
 * The single cast in this file, and the reason there is only one: the registry holds
 * types over different value shapes, and a per-entry cast would spread the same
 * erasure across every definition. Pairing editor and serializer here is what keeps
 * it sound — nothing else ever produces a value for this key.
 */
function defineArgumentType<T>(type: ArgumentType<T>): ErasedArgumentType {
  return type as unknown as ErasedArgumentType
}

const warn = (message: string): Diagnostic[] => [{ severity: 'warning', message }]

/**
 * The options an argument's editor, validator and default are handed.
 *
 * `optional` rides along with the authored typeOptions because a *default* has to know
 * it. A default is a suggestion for a value the command needs; an optional argument
 * does not need one, and seeding it anyway puts a value in the command the user never
 * asked for — `/particle … 0 10 force @p`, where `@p` is a viewer list nobody chose.
 * `numberType` already returned '' for exactly this reason and said so; the reasoning
 * was never carried across to the selector, which is the only other seeded default.
 *
 * Both readers of a value — the serializer and ArgumentView — call this, so the form
 * and the output cannot disagree about what an untouched field holds.
 */
export function argumentOptions(
  node: Pick<ArgumentNode, 'typeOptions' | 'optional' | 'variadic' | 'default'>,
): ArgumentOptions {
  if (!node.optional && !node.variadic && node.default === undefined) return node.typeOptions ?? {}
  return {
    ...node.typeOptions,
    ...(node.optional ? { optional: true } : {}),
    ...(node.variadic ? { variadic: true } : {}),
    // Travels with the options so an editor can show the value in force when the field
    // is empty. It is the game's value, not a seed: the field stays empty, and the
    // serializer writes it only when a later argument needs this slot filled.
    ...(node.default !== undefined ? { default: node.default } : {}),
  }
}

function numberType(key: ArgumentTypeKey, integral: boolean): ErasedArgumentType {
  return defineArgumentType<number | ''>({
    key,
    editor: NumberEditor,
    serialize: (value) => (value === '' ? '' : String(value)),
    validate: (value, options) => {
      if (value === '') return []
      if (integral && !Number.isInteger(value)) return warn(`${key} must be a whole number`)
      const { min, max } = options
      if (typeof min === 'number' && value < min) return warn(`Minimum is ${min}`)
      if (typeof max === 'number' && value > max) return warn(`Maximum is ${max}`)
      return []
    },
    // Empty, not `min`. min is a bound, not a suggestion: seeding it put a count on
    // every /give whether the user asked for one or not, and an optional argument
    // that cannot be left out is not optional.
    defaultValue: () => '',
  })
}

function textType(key: ArgumentTypeKey): ErasedArgumentType {
  return defineArgumentType<string>({
    key,
    editor: TextEditor,
    // Brigadier's quoted-string rules are a later concern. A bare token round-trips
    // unchanged, which is what every argument in the acceptance set needs.
    serialize: (value) => value.trim(),
    validate: () => [],
    defaultValue: () => '',
  })
}

/**
 * A position or rotation: one field per axis, stored as one string (coordinates.ts).
 * A group, because it is several fields and the row's label names them together.
 */
function coordinateType(key: keyof typeof COORDINATE_SHAPES): ErasedArgumentType {
  const shape = COORDINATE_SHAPES[key]!
  return defineArgumentType<string>({
    key,
    labelling: 'group',
    editor: coordinateEditor(shape),
    serialize: (value) => serializeCoordinates(value, shape),
    validate: (value) => coordinateProblems(value, shape).flatMap(warn),
    defaultValue: () => '',
  })
}

/** A closed set of words, from src/data/authored/enums.ts. */
function enumType(key: ArgumentTypeKey, values: readonly string[]): ErasedArgumentType {
  const control = enumControl(values)
  return defineArgumentType<string>({
    key,
    labelling: control === 'segmented' ? 'group' : 'control',
    editor: enumEditor(values, control),
    serialize: (value) => value,
    validate: (value) =>
      value === '' || values.includes(value) ? [] : warn(`Not one of ${values.join(', ')}`),
    defaultValue: () => '',
  })
}

/** A text field with a syntax of its own, checked by a pattern and explained if not met. */
function patternType(key: ArgumentTypeKey, pattern: RegExp, hint: string): ErasedArgumentType {
  return defineArgumentType<string>({
    key,
    editor: TextEditor,
    serialize: (value) => value.trim(),
    validate: (value) => (value.trim() === '' || pattern.test(value.trim()) ? [] : warn(hint)),
    defaultValue: () => '',
  })
}

const TYPES: ErasedArgumentType[] = [
  numberType('integer', true),
  numberType('float', false),
  numberType('double', false),
  // Three states for an optional bool: true, false, and '' for "not given". Two was one
  // too few. A checkbox that could only say true or false wrote `false` into every
  // command whose branch held an untouched optional bool, so `/effect give … 30` came
  // out as `… 30 false`. An optional bool that is not given now contributes nothing,
  // like every other optional argument, and ToggleEditor stores '' whenever the box is
  // put back to the value the game assumes.
  defineArgumentType<boolean | ''>({
    key: 'bool',
    editor: ToggleEditor,
    serialize: (value) => (value === '' ? '' : value ? 'true' : 'false'),
    validate: () => [],
    defaultValue: (options) => (options.optional ? '' : false),
  }),
  defineArgumentType<string>({
    key: 'entity_selector',
    editor: SelectorEditor,
    serialize: (value) => value.trim(),
    validate: (value, options) => {
      const trimmed = value.trim()
      if (trimmed === '' || !trimmed.startsWith('@')) return []
      const legal = selectorsFor(options).map((s) => s.token)
      const shorthand = trimmed.slice(0, 2)
      if (!legal.includes(shorthand)) {
        return warn(`${shorthand} is not valid here. Try ${legal.join(', ')}.`)
      }
      return []
    },
    // Empty when the argument is optional, for the reason argumentOptions gives: a
    // seeded '@p' in an argument the user may leave out is a viewer list nobody chose.
    defaultValue: (options) => (options.optional ? '' : (selectorsFor(options)[0]?.token ?? '')),
  }),
  textType('string'),
  // The first two deep types. Everything about them is hand-authored — Brigadier
  // describes each as one opaque token — which is exactly why they are the product
  // rather than a gap the fallback papers over.
  defineArgumentType<ItemStackValue>({
    key: 'item_stack',
    labelling: 'group',
    editor: ItemStackEditor,
    serialize: serializeItemStack,
    validate: (value, _options, ctx) => validateItemStack(value, ctx),
    defaultValue: () => EMPTY_ITEM_STACK,
  }),
  defineArgumentType<TextComponent>({
    key: 'text_component',
    labelling: 'group',
    editor: TextComponentEditor,
    serialize: (value, ctx) =>
      isEmptyTextComponent(value) ? '' : serializeTextComponent(value, ctx),
    validate: validateTextComponent,
    defaultValue: emptyTextComponent,
  }),
  // WorldEdit's two. Neither comes from a Brigadier parser — there is no mcmeta for a
  // plugin — so both are authored end to end, and they are the evidence that `dialect`
  // is a field rather than a subsystem: they register here beside the vanilla types
  // and are reached by the same renderer.
  defineArgumentType<PatternValue>({
    key: 'we_pattern',
    labelling: 'group',
    editor: PatternEditor,
    serialize: serializePattern,
    validate: (value, _options, ctx) => validatePattern(value, ctx),
    defaultValue: () => EMPTY_PATTERN,
  }),
  defineArgumentType<string>({
    key: 'we_expression',
    editor: ExpressionEditor,
    // Emitted as typed, spaces and all. That is only sound because the argument is
    // variadic and last: it takes every remaining token, so there is nothing after it
    // for a space to be mistaken for a separator between.
    serialize: (value) => value.trim(),
    validate: (value) => validateExpression(value),
    defaultValue: () => '',
  }),
  coordinateType('block_pos'),
  coordinateType('vec3'),
  coordinateType('column_pos'),
  coordinateType('vec2'),
  coordinateType('rotation'),
  coordinateType('angle'),
  defineArgumentType<string>({
    key: 'swizzle',
    labelling: 'group',
    editor: SwizzleEditor,
    serialize: (value) => value,
    validate: () => [],
    defaultValue: () => '',
  }),
  // An id. The skeleton names the registry for some of them, and those complete from
  // it and warn on an id it does not hold; the rest are a text field.
  defineArgumentType<string>({
    key: 'resource_location',
    editor: ResourceEditor,
    serialize: (value) => value.trim(),
    validate: validateResource,
    defaultValue: () => '',
  }),
  enumType('gamemode', GAMEMODES),
  enumType('entity_anchor', ENTITY_ANCHORS),
  enumType('heightmap', HEIGHTMAPS),
  enumType('template_mirror', TEMPLATE_MIRRORS),
  enumType('template_rotation', TEMPLATE_ROTATIONS),
  enumType('operation', SCOREBOARD_OPERATIONS),
  enumType('color', TEAM_COLORS),
  // A number and an optional unit: days, seconds or ticks, ticks when none is given.
  patternType('time', /^(\d+\.?\d*|\.\d+)[dst]?$/, 'A number, then d, s or t (ticks if none)'),
  // An exact whole number, or a range with either end left open: 1..5, ..5, 1..
  patternType(
    'int_range',
    /^(-?\d+|-?\d+\.\.(-?\d+)?|\.\.-?\d+)$/,
    'A whole number or a range: 1..5, ..5, 1..',
  ),
  // Free-form names: a player or entity name, a team, a scoreboard objective. Text
  // fields, registered by name so the parser table records them as handled.
  textType('score_holder'),
  textType('objective'),
  textType('team'),
  textType('message'),
  // The fallback a deep parser binds to before its editor exists. Its presence is
  // what lets derivation degrade a command to a text field instead of failing.
  textType('raw_text'),
]

const REGISTRY = new Map<ArgumentTypeKey, ErasedArgumentType>(TYPES.map((t) => [t.key, t]))

/** The fallback bound when a deep parser has no editor yet. */
export const FALLBACK_TYPE: ArgumentTypeKey = 'raw_text'

export function hasArgumentType(key: ArgumentTypeKey): boolean {
  return REGISTRY.has(key)
}

export function registeredTypeKeys(): ArgumentTypeKey[] {
  return [...REGISTRY.keys()]
}

/**
 * The type for a key, or the raw_text fallback.
 *
 * Unlike lookupParser this does not throw: by the time a definition is being
 * rendered, an unimplemented deep type must degrade to a text field rather than blank
 * the page. The hard error for an unmapped *shallow* parser belongs at derivation
 * time, where there is a build to fail — see src/data/authored/parsers.ts.
 */
export function lookupArgumentType(key: ArgumentTypeKey): ErasedArgumentType {
  const found = REGISTRY.get(key) ?? REGISTRY.get(FALLBACK_TYPE)
  if (!found) throw new Error(`the ${FALLBACK_TYPE} fallback is not registered`)
  return found
}
