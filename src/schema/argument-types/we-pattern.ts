import type { BlockStates, SerializeContext } from '../../data/versions/types'
import type { Diagnostic } from '../types'

/**
 * A WorldEdit block pattern.
 *
 * A list of entries, each placed by relative chance, and each one of four kinds. Read
 * from WorldEdit 7.3.6's pattern parsers, the release 1.21.1 servers run:
 *
 * - **block**: an id with states (`oak_log[axis=x]`). `*` in front leaves every state
 *   it does not name random (`RandomStatePatternParser`, which parses the rest as a
 *   wildcard block), so a random state is one left out.
 * - **tag**: `##logs` is each block in the tag in its default state, `##*logs` every
 *   state of every one (`BlockCategoryPatternParser`).
 * - **apply**: `^` changes what is already there rather than replacing it: a type,
 *   states, or both (`TypeOrStateApplyingPatternParser`), so `^[waterlogged=false]`
 *   dries whatever is in place without touching what it is.
 * - **clipboard**: `#clipboard`, or `#copy`, tiles the clipboard, offset by `@[x,y,z]`
 *   (`ClipboardPatternParser`).
 *
 * Verified against `RandomPatternParser`: entries are comma-separated (commas inside
 * `[]` do not split), a weight is `[0-9]+(\.[0-9]*)?` followed by `%`, and an entry
 * without one counts as 1. Weights are relative chances, **not** percentages,
 * `50%stone,50%dirt` and `1%stone,1%dirt` being the same pattern, so nothing here asks
 * them to total 100.
 */
export type PatternKind = 'block' | 'tag' | 'apply' | 'clipboard'

export interface PatternEntry {
  /**
   * The id the entry names: a block, a block tag (bare, for `tag`), or the type an
   * `apply` sets, empty to keep the type. Registries hold ids bare; WorldEdit takes a
   * namespaced one too.
   */
  block: string
  /** Relative chance. Empty means unweighted, which WorldEdit reads as 1. */
  weight: number | ''
  /** Absent is `block`, which is every entry saved before the other kinds existed. */
  kind?: PatternKind
  /** `block`: the property values it names. `apply`: the states to set. */
  states?: Readonly<Record<string, string>>
  /** `block`: every property `states` leaves out is random, written `*block[...]`. */
  random?: boolean
  /** `tag`: every state of every block in it, not each block's default. */
  anyState?: boolean
  /** `clipboard`: where the clipboard's tiling starts, in blocks. */
  offset?: readonly [number, number, number]
}

export interface PatternValue {
  entries: readonly PatternEntry[]
}

export const EMPTY_PATTERN: PatternValue = { entries: [] }

/** The registry a pattern's ids come from. Blocks, not items: `//generate` places blocks. */
export const PATTERN_REGISTRY = 'block'

/** The registry a `##tag` entry's tag comes from. */
export const TAG_REGISTRY = 'tag/block'

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

/**
 * Whether an id names a block in this version.
 *
 * Registries hold ids bare, and WorldEdit accepts a namespaced one, so the namespace
 * is stripped before the lookup. Exported because the editor asks the same question to
 * decide whether to mark the field — asking it differently is how a legitimate
 * namespaced id came to be outlined in red while the validator beside it said nothing.
 */
export function isKnownBlock(id: string, ctx: SerializeContext): boolean {
  const trimmed = id.trim()
  if (trimmed === '') return true
  const bare = trimmed.startsWith(':') ? trimmed : trimmed.split(':').pop()!
  return ctx.registries.has(PATTERN_REGISTRY, bare)
}

const stateList = (states: Readonly<Record<string, string>>) =>
  Object.entries(states).map(([key, value]) => `${key}=${value}`)

/** One entry as pattern text, without its weight, or '' when it names nothing yet. */
export function entryText(entry: PatternEntry): string {
  const id = entry.block.trim()
  const states = entry.states ?? {}
  switch (entry.kind ?? 'block') {
    case 'block': {
      if (id === '') return ''
      const fixed = stateList(states)
      return `${entry.random ? '*' : ''}${id}${fixed.length > 0 ? `[${fixed.join(',')}]` : ''}`
    }
    case 'tag':
      return id === '' ? '' : `##${entry.anyState ? '*' : ''}${id.replace(/^#+/, '')}`
    case 'apply': {
      const set = stateList(states)
      if (id === '' && set.length === 0) return ''
      return `^${id}${set.length > 0 ? `[${set.join(',')}]` : ''}`
    }
    case 'clipboard': {
      const offset = entry.offset ?? [0, 0, 0]
      return offset.some((n) => n !== 0) ? `#clipboard@[${offset.join(',')}]` : '#clipboard'
    }
  }
}

/** Entries that name something. A half-added row is not part of the pattern. */
const filled = (value: PatternValue): readonly PatternEntry[] =>
  value.entries.filter((entry) => entryText(entry) !== '')

export function serializePattern(value: PatternValue): string {
  const entries = filled(value)
  if (entries.length === 0) return ''

  // A weight on a lone entry is dropped rather than written. WorldEdit's
  // RandomPatternParser bails out on a single token — `if (patterns.size() == 1)
  // return null` — handing it to the plain block parser, which does not understand
  // `50%`. So `50%stone` on its own is not a pattern that favours stone; it is a
  // parse error. One entry is always 100% of itself anyway.
  if (entries.length === 1) return entryText(entries[0]!)

  return entries
    .map((entry) => (entry.weight === '' ? '' : `${entry.weight}%`) + entryText(entry))
    .join(',')
}

/** Split on the commas between entries, not the ones inside `[...]`. */
function splitEntries(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '[') depth++
    if (char === ']') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      out.push(current)
      current = ''
    } else current += char
  }
  out.push(current)
  return out.map((part) => part.trim()).filter((part) => part !== '')
}

function readStates(text: string | undefined): Record<string, string> | undefined {
  if (text === undefined) return undefined
  const pairs = text
    .split(',')
    .map((pair) => pair.split('='))
    .filter((pair): pair is [string, string] => pair.length === 2)
  return Object.fromEntries(pairs.map(([k, v]) => [k.trim(), v.trim()]))
}

/** One entry read back from its text. What it cannot read stays whole as a block id. */
function readEntry(text: string, weight: number | ''): PatternEntry {
  const tag = /^##(\*?)([a-z0-9_:./-]+)$/.exec(text)
  if (tag) return { kind: 'tag', block: tag[2]!, weight, ...(tag[1] ? { anyState: true } : {}) }

  const clip = /^#(?:clipboard|copy)(?:@\[(-?\d+),(-?\d+),(-?\d+)\])?$/i.exec(text)
  if (clip) {
    const offset = clip[1] === undefined ? undefined : ([+clip[1], +clip[2]!, +clip[3]!] as const)
    return { kind: 'clipboard', block: '', weight, ...(offset ? { offset } : {}) }
  }

  const apply = /^\^([a-z0-9_:]*)(?:\[(.*)\])?$/.exec(text)
  if (apply) {
    const states = readStates(apply[2])
    return { kind: 'apply', block: apply[1]!, weight, ...(states ? { states } : {}) }
  }

  const block = /^(\*?)([a-z0-9_:]+)(?:\[(.*)\])?$/.exec(text)
  if (block && (block[1] || block[3] !== undefined)) {
    const states = readStates(block[3])
    return {
      block: block[2]!,
      weight,
      ...(states ? { states } : {}),
      ...(block[1] ? { random: true } : {}),
    }
  }
  return { block: text, weight }
}

/**
 * A pattern read back from its text, the inverse of `serializePattern`. An entry it
 * cannot read keeps its whole text as the block, which is the free-text bargain the
 * field makes.
 */
export function parsePattern(text: string): PatternValue {
  const entries = splitEntries(text).map((part): PatternEntry => {
    const weighted = /^([0-9]+(?:\.[0-9]*)?)%(.+)$/.exec(part)
    return weighted ? readEntry(weighted[2]!.trim(), Number(weighted[1])) : readEntry(part, '')
  })
  return { entries }
}

export function validatePattern(value: PatternValue, ctx: SerializeContext): Diagnostic[] {
  const entries = filled(value)
  const out: Diagnostic[] = []

  for (const entry of entries) {
    const kind = entry.kind ?? 'block'
    const id = entry.block.trim()
    if (kind === 'tag') {
      const tag = id.replace(/^#+/, '')
      if (!ctx.registries.has(TAG_REGISTRY, tag))
        out.push(warn(`${tag} is not a block tag in this version.`))
      continue
    }
    if (kind === 'clipboard' || id === '') continue
    if (!isKnownBlock(id, ctx)) {
      // A block id with brackets or a star in it is a pattern typed by hand, which the
      // field accepts as it is; only a plain id that names nothing is worth a warning.
      if (/^[a-z0-9_:]+$/.test(id)) out.push(warn(`${id} is not a block in this version.`))
      continue
    }
    const known = ctx.registries.blockStates?.(id)
    if (kind !== 'block' || known === undefined) continue
    for (const [key, state] of Object.entries(entry.states ?? {})) {
      if (!(key in known.properties)) out.push(warn(`${id} has no state called ${key}.`))
      else if (!known.properties[key]!.includes(state)) {
        out.push(warn(`${id}'s ${key} cannot be ${state}.`))
      }
    }
  }

  if (entries.length === 1 && entries[0]!.weight !== '') {
    out.push(
      warn(
        'A weight needs something to compete with, so it is left out of a single-block pattern.',
      ),
    )
  }

  if (entries.some(({ weight }) => weight !== '' && weight <= 0)) {
    out.push(warn('A weight of zero or less never places its block.'))
  }

  return out
}

/**
 * A property left at the block's default, and one left random, as the editor's
 * property list names them. Parenthesised, so no state value can be either.
 */
export const DEFAULT_STATE = '(default)'
export const RANDOM_STATE = '(random)'

/** Every property of a block entry at once, after one of them changed. */
export function withProperty(
  entry: PatternEntry,
  known: BlockStates,
  key: string,
  choice: string,
): PatternEntry {
  const states: Record<string, string> = { ...entry.states }
  let random = entry.random === true
  if (choice === RANDOM_STATE) {
    // `*` randomises what the brackets leave out, so the properties that were at their
    // default have to be written out to stay there.
    if (!random) {
      for (const property of Object.keys(known.properties)) {
        if (property !== key && !(property in states)) states[property] = known.defaults[property]!
      }
    }
    random = true
    delete states[key]
  } else if (choice === DEFAULT_STATE) {
    if (random) states[key] = known.defaults[key]!
    else delete states[key]
  } else {
    states[key] = choice
  }
  if (random && Object.keys(known.properties).every((property) => property in states)) {
    random = false
  }
  if (!random) {
    for (const [property, state] of Object.entries(states)) {
      if (known.defaults[property] === state) delete states[property]
    }
  }
  const { states: _states, random: _random, ...rest } = entry
  return {
    ...rest,
    ...(Object.keys(states).length > 0 ? { states } : {}),
    ...(random ? { random: true } : {}),
  }
}
