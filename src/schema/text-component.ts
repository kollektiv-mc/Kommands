import type { SerializeContext } from '../data/versions/types'

/**
 * Text components, as a structured tree.
 *
 * The value model is a tree and not a string on purpose. Serialization to a quoted
 * JSON string or to SNBT is then a trait branch at the boundary — one function —
 * rather than two string builders that drift apart. Building this as a string first
 * and adding SNBT later is the rewrite that decision avoids.
 *
 * The editor is #8's work. This is the serializer, and it exists now because a trait
 * branch that nothing exercises is a trait branch nobody has tested: `custom_name`
 * and `lore` reach for it from #7, and /tellraw from #8.
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
 * Serialize a text component for the target version.
 *
 * The branch is on `textComponentFormat`, which is `json-string` up to 1.21.4 and
 * `snbt` from 1.21.5. Both forms are the same tree; only the punctuation differs —
 * SNBT drops the quotes around keys and is not wrapped in an outer quoted string.
 */
export function serializeTextComponent(value: TextComponent, ctx: SerializeContext): string {
  return ctx.traits.textComponentFormat === 'snbt' ? snbt(value) : jsonString(value)
}

/** Pre-1.21.5: a JSON object, wrapped in single quotes so it survives as one token. */
function jsonString(value: TextComponent): string {
  return `'${JSON.stringify(prune(value))}'`
}

/** 1.21.5+: SNBT — bare keys, double-quoted string values, no outer wrapper. */
function snbt(value: TextComponent): string {
  const entries = Object.entries(prune(value)).map(([key, v]) => {
    if (typeof v === 'string') return `${key}:"${v.replace(/(["\\])/g, '\\$1')}"`
    if (typeof v === 'boolean') return `${key}:${v}`
    if (Array.isArray(v)) return `${key}:[${v.map((c) => snbt(c as TextComponent)).join(',')}]`
    return `${key}:${String(v)}`
  })
  return `{${entries.join(',')}}`
}

/** Drop undefined keys so the two forms agree on which fields are present. */
function prune(value: TextComponent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue
    out[key] = key === 'extra' ? (v as TextComponent[]).map(prune) : v
  }
  return out
}
