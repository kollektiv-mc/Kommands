import type { SerializeContext } from '../data/versions/types'
import { writeSnbt, type SnbtValue } from './snbt'

/**
 * Text components, as a structured tree.
 *
 * The value model is a tree and not a string on purpose. Serialization to a quoted
 * JSON string or to SNBT is then a trait branch at the boundary — one function —
 * rather than two string builders that drift apart. Building this as a string first
 * and adding SNBT later is the rewrite that decision avoids.
 *
 * `custom_name` and `lore` reach for this from #7, and /tellraw from #8. The editor
 * that #7 registers covers text, colour and the formatting flags; the rest of the
 * component grammar — translate, selector, score, click and hover events — is #8's,
 * and extends this interface rather than replacing it.
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
 * Serialize a text component for the target version.
 *
 * The branch is on `textComponentFormat`, which is `json-string` up to 1.21.4 and
 * `snbt` from 1.21.5. Both forms are the same tree; only the punctuation differs —
 * SNBT drops the quotes around keys and is not wrapped in an outer quoted string.
 */
export function serializeTextComponent(value: TextComponent, ctx: SerializeContext): string {
  return ctx.traits.textComponentFormat === 'snbt'
    ? writeSnbt(toSnbt(value))
    : `'${JSON.stringify(prune(value))}'`
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

/** Pre-1.21.5: a JSON object, wrapped in single quotes so it survives as one token. */
function prune(value: TextComponent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of FIELDS) {
    const field = value[key]
    if (field === undefined) continue
    out[key] = key === 'extra' ? (field as TextComponent[]).map(prune) : field
  }
  return out
}
