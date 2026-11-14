import type { SerializeContext } from '../../data/versions/types'
import type { Diagnostic } from '../types'
import { validateExpression } from './we-expression'
import { isKnownBlock } from './we-pattern'

/**
 * A WorldEdit mask: which blocks an edit may touch.
 *
 * Read from WorldEdit 7.3.6's mask parsers, the release 1.21.1 servers run, rather than
 * from the docs site, which documents the development branch and runs ahead of it
 * (`#fullcube` and `#clipboard` are not in 7.3.6). What the grammar allows decides the
 * value's shape:
 *
 * - Masks separated by a **space** must all match (an intersection). There is no
 *   general "or" and no brackets. A comma only lists blocks or biomes inside one mask.
 * - `!` negates the one mask after it, so `!stone,dirt` is "neither stone nor dirt".
 * - `<` and `>` move the one mask after it a block up or down, and stack: `>>stone` is
 *   "stone two blocks below".
 * - A tag is `##name`, a chance is `%n` where n is a real percentage (unlike a
 *   pattern's weights), and an expression is `=expr` with no spaces in it.
 *
 * A mask with a space in it is one argument to the command, so it is written in
 * double quotes: `//replace "stone <air" dirt`, as WorldEdit's own docs write it.
 *
 * The common case is the first three fields, which is what the editor leads with:
 * blocks to include, blocks to leave out, and a chance. `rules` holds everything else
 * the grammar can say, one mask each, all of which must match.
 */
export interface MaskValue {
  /** Block ids, or one block tag written `#name`. The grammar cannot "or" a tag with blocks. */
  include: readonly string[]
  /** Block ids and block tags (`#name`) to leave out. */
  exclude: readonly string[]
  /** The share of matching blocks to touch, 1 to 100. Empty is all of them. */
  chance: number | ''
  rules: readonly MaskRule[]
}

/** What one rule tests. */
export type MaskTest =
  | 'blocks'
  | 'tag'
  | 'air'
  | 'existing'
  | 'solid'
  | 'surface'
  | 'states'
  | 'biome'
  | 'selection'
  | 'chance'
  | 'expression'

export interface MaskRule {
  test: MaskTest
  /** Match what the test does not. */
  not: boolean
  /**
   * Which block the test looks at: 0 is the block itself, 2 is the one two above, -1
   * the one below. Only the tests in `OFFSET_TESTS` can look elsewhere.
   */
  offset: number
  /** Block ids for `blocks`, biome ids for `biome`, `key=value` pairs for `states`. */
  values: readonly string[]
  /** A block tag for `tag` (bare, no `#`), an expression for `expression`. */
  text: string
  /** `states` only: the block must have every listed state (`^=[…]`), not merely not disagree. */
  exact: boolean
  /** `chance` only: 1 to 100. */
  chance: number
}

export const EMPTY_MASK: MaskValue = { include: [], exclude: [], chance: '', rules: [] }

/** A rule as it is first added, before the user picks a test. */
export const NEW_RULE: MaskRule = {
  test: 'blocks',
  not: false,
  offset: 0,
  values: [],
  text: '',
  exact: false,
  chance: 50,
}

/**
 * The tests an offset applies to. A chance or an expression at another block means the
 * same as at this one, and the selection does not move with the block, so the editor
 * offers the offset only where it changes something.
 */
export const OFFSET_TESTS: ReadonlySet<MaskTest> = new Set([
  'blocks',
  'tag',
  'air',
  'existing',
  'solid',
  'surface',
  'states',
  'biome',
])

/**
 * The tests that are a fixed word. `#surface` is a non-air block with air on at least
 * one side, from `SurfaceMaskParser`; `#solid` is a block that stops movement;
 * `#existing` is any block but air, which is not the same as `!air` (cave and void air
 * are air too); `#sel` is the selection when the command runs.
 */
const FIXED: Partial<Record<MaskTest, string>> = {
  air: '#air',
  existing: '#existing',
  solid: '#solid',
  surface: '#surface',
  selection: '#sel',
}

/** The registry the block tags come from, read bare. */
export const BLOCK_TAG_REGISTRY = 'tag/block'
export const BIOME_REGISTRY = 'worldgen/biome'

const isTag = (entry: string) => entry.startsWith('#')
const bareTag = (entry: string) => entry.replace(/^#+/, '').trim()
const clean = (entries: readonly string[]) =>
  entries.map((entry) => entry.trim()).filter((entry) => entry !== '' && entry !== '#')

/** One rule as mask text, or '' when it has nothing to test yet. */
export function serializeRule(rule: MaskRule): string {
  let core = ''
  switch (rule.test) {
    case 'blocks':
    case 'biome': {
      const values = clean(rule.values)
      if (values.length > 0) core = (rule.test === 'biome' ? '$' : '') + values.join(',')
      break
    }
    case 'tag':
      if (bareTag(rule.text) !== '') core = `##${bareTag(rule.text)}`
      break
    case 'states': {
      const values = clean(rule.values)
      if (values.length > 0) core = `${rule.exact ? '^=' : '^'}[${values.join(',')}]`
      break
    }
    case 'chance':
      core = `%${rule.chance}`
      break
    case 'expression': {
      const text = rule.text.replace(/\s+/g, '')
      if (text !== '') core = `=${text}`
      break
    }
    default:
      core = FIXED[rule.test] ?? ''
  }
  if (core === '') return ''
  const steps = OFFSET_TESTS.has(rule.test) ? Math.trunc(rule.offset) : 0
  // `<` underlays: `<stone` is a block with stone above it. So looking up writes `<`.
  const shift = (steps > 0 ? '<' : '>').repeat(Math.abs(steps))
  return (rule.not ? '!' : '') + shift + core
}

/** The masks a value is made of, each one token, in the order they are written. */
export function maskParts(value: MaskValue): string[] {
  const parts: string[] = []
  const include = clean(value.include)
  const tag = include.find(isTag)
  // A tag wins over blocks beside it, because the two cannot be written as one mask
  // and writing both would ask for blocks that are in the tag *and* in the list.
  if (tag !== undefined) parts.push(`##${bareTag(tag)}`)
  else if (include.length > 0) parts.push(include.join(','))

  const exclude = clean(value.exclude)
  const blocks = exclude.filter((entry) => !isTag(entry))
  if (blocks.length > 0) parts.push(`!${blocks.join(',')}`)
  for (const entry of exclude.filter(isTag)) parts.push(`!##${bareTag(entry)}`)

  if (value.chance !== '' && value.chance < 100) parts.push(`%${value.chance}`)

  for (const rule of value.rules) {
    const text = serializeRule(rule)
    if (text !== '') parts.push(text)
  }
  return parts
}

export function serializeMask(value: MaskValue): string {
  const parts = maskParts(value)
  return parts.length > 1 ? `"${parts.join(' ')}"` : (parts[0] ?? '')
}

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

function unknownIn(
  entries: readonly string[],
  ctx: SerializeContext,
  registry: string,
  what: string,
): Diagnostic[] {
  return clean(entries)
    .filter((entry) =>
      registry === 'block'
        ? !isKnownBlock(entry, ctx)
        : !ctx.registries.has(registry, entry.split(':').pop()!),
    )
    .map((entry) => warn(`${entry} is not a ${what} in this version.`))
}

function tagsIn(entries: readonly string[], ctx: SerializeContext): Diagnostic[] {
  return unknownIn(clean(entries).filter(isTag).map(bareTag), ctx, BLOCK_TAG_REGISTRY, 'block tag')
}

export function validateMask(value: MaskValue, ctx: SerializeContext): Diagnostic[] {
  const out: Diagnostic[] = []
  const include = clean(value.include)
  const blocks = (entries: readonly string[]) => clean(entries).filter((entry) => !isTag(entry))

  out.push(...unknownIn(blocks(include), ctx, 'block', 'block'))
  out.push(...tagsIn(include, ctx))
  if (include.some(isTag) && include.length > 1) {
    out.push(
      warn('A mask can include one tag or a list of blocks, not both. Only the tag is used.'),
    )
  }
  out.push(...unknownIn(blocks(value.exclude), ctx, 'block', 'block'))
  out.push(...tagsIn(value.exclude, ctx))

  if (value.chance !== '' && (value.chance < 1 || value.chance > 100)) {
    out.push(warn('A chance is a percentage from 1 to 100.'))
  }

  for (const rule of value.rules) {
    if (rule.test === 'blocks') out.push(...unknownIn(rule.values, ctx, 'block', 'block'))
    if (rule.test === 'biome') out.push(...unknownIn(rule.values, ctx, BIOME_REGISTRY, 'biome'))
    if (rule.test === 'tag' && bareTag(rule.text) !== '') {
      out.push(...unknownIn([bareTag(rule.text)], ctx, BLOCK_TAG_REGISTRY, 'block tag'))
    }
    if (rule.test === 'states') {
      for (const state of clean(rule.values)) {
        if (!/^[a-z0-9_]+=[a-z0-9_]+$/.test(state)) {
          out.push(warn(`${state} is not a state. Write it as name=value.`))
        }
      }
    }
    if (rule.test === 'chance' && (rule.chance < 1 || rule.chance > 100)) {
      out.push(warn('A chance is a percentage from 1 to 100.'))
    }
    if (rule.test === 'expression') out.push(...validateExpression(rule.text.replace(/\s+/g, '')))
  }
  return out
}
