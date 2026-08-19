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
  node: Pick<ArgumentNode, 'typeOptions' | 'optional'>,
): ArgumentOptions {
  return node.optional ? { ...node.typeOptions, optional: true } : (node.typeOptions ?? {})
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

const TYPES: ErasedArgumentType[] = [
  numberType('integer', true),
  numberType('float', false),
  numberType('double', false),
  defineArgumentType<boolean>({
    key: 'bool',
    editor: ToggleEditor,
    serialize: (value) => (value ? 'true' : 'false'),
    validate: () => [],
    defaultValue: () => false,
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
    editor: ItemStackEditor,
    serialize: serializeItemStack,
    validate: (value, _options, ctx) => validateItemStack(value, ctx),
    defaultValue: () => EMPTY_ITEM_STACK,
  }),
  defineArgumentType<TextComponent>({
    key: 'text_component',
    editor: TextComponentEditor,
    serialize: (value, ctx) =>
      isEmptyTextComponent(value) ? '' : serializeTextComponent(value, ctx),
    validate: validateTextComponent,
    defaultValue: emptyTextComponent,
  }),
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
