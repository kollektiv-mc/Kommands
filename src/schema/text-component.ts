import type { SerializeContext } from '../data/versions/types'
import { writeSnbt, type SnbtValue } from './snbt'

/**
 * Text components, as a structured tree.
 *
 * The value model is a tree and not a string on purpose. JSON versus SNBT is then a
 * trait branch at the boundary rather than two string builders that drift apart.
 * Building this as a string first and adding SNBT later is the rewrite that decision
 * avoids.
 *
 * There are two boundaries, not one, and the difference is easy to miss: a component
 * written as a command *argument* is bare, and the same component written into an
 * item's *data-component field* is a quoted string before 1.21.5. See the two
 * functions below.
 *
 * The registered editor covers text, colour and the formatting flags — enough for
 * `custom_name`, `lore` and a plain /tellraw. The rest of the grammar — `extra`
 * children, translate, selector, score, click and hover events — is #8's, and extends
 * this interface rather than replacing it.
 */
export interface TextComponent {
  text: string
  /** A colour name or #rrggbb. Comes from authored data, never a literal in a component. */
  color?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
  extra?: TextComponent[]
}

/**
 * The order fields are written in, for both forms.
 *
 * Iterating the value's own keys would make output depend on the order the editor
 * happened to assign them, so setting a colour before typing the text would change
 * the emitted string. Canonical fixtures are byte-exact comparisons; a field order
 * nothing pins down cannot be asserted.
 */
const FIELDS = [
  'text',
  'color',
  'bold',
  'italic',
  'underlined',
  'strikethrough',
  'obfuscated',
  'extra',
] as const satisfies ReadonlyArray<keyof TextComponent>

/**
 * A text component written where a command argument expects one directly.
 *
 * `/tellraw @a {"text":"Server restarting","color":"red","bold":true}` — bare, with
 * no surrounding quotes. The branch is on `textComponentFormat`, which is
 * `json-string` up to 1.21.4 and `snbt` from 1.21.5.
 */
export function serializeTextComponent(value: TextComponent, ctx: SerializeContext): string {
  return ctx.traits.textComponentFormat === 'snbt'
    ? writeSnbt(toSnbt(value))
    : JSON.stringify(prune(value))
}

/**
 * The same component written into a *data-component field*, which is not the same
 * thing and is the mistake worth naming.
 *
 * `custom_name`, `item_name` and each `lore` line are typed
 * `#[until="1.21.5"] #[text_component] string` — before 1.21.5 the field holds a
 * **string** whose contents are the JSON, so it is quoted:
 * `[custom_name='{"text":"Digger"}']`. From 1.21.5 the field holds the component
 * itself and there is nothing to quote. Passing the argument form of the same value
 * into an item produces a command that parses and does nothing.
 *
 * Single quotes rather than double, so the JSON's own quotes need no escaping. The
 * two characters that do — a quote of that kind, and a backslash — are escaped here,
 * on top of the escaping JSON has already done.
 */
export function textComponentField(value: TextComponent, ctx: SerializeContext): SnbtValue {
  if (ctx.traits.textComponentFormat === 'snbt') return toSnbt(value)
  const json = JSON.stringify(prune(value)).replace(/(['\\])/g, '\\$1')
  return { kind: 'raw', text: `'${json}'` }
}

/** 1.21.5+: SNBT — bare keys, double-quoted string values, no outer wrapper. */
function toSnbt(value: TextComponent): SnbtValue {
  const entries: Array<readonly [string, SnbtValue]> = []
  for (const key of FIELDS) {
    const field = value[key]
    if (field === undefined) continue
    if (key === 'extra') {
      entries.push([key, { kind: 'list', items: (field as TextComponent[]).map(toSnbt) }])
    } else if (typeof field === 'string') {
      entries.push([key, { kind: 'string', value: field }])
    } else if (typeof field === 'boolean') {
      entries.push([key, { kind: 'bool', value: field }])
    }
  }
  return { kind: 'compound', entries }
}

/** Pre-1.21.5: the component as a JSON object, with undefined fields dropped. */
function prune(value: TextComponent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of FIELDS) {
    const field = value[key]
    if (field === undefined) continue
    out[key] = key === 'extra' ? (field as TextComponent[]).map(prune) : field
  }
  return out
}
