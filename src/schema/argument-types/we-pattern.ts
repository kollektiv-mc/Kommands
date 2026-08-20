import type { SerializeContext } from '../../data/versions/types'
import type { Diagnostic } from '../types'

/**
 * A WorldEdit block pattern.
 *
 * WorldEdit's pattern grammar is large — `#clipboard`, `##oak_log`, `#simplex[…]` —
 * and this covers the one shape `//generate` is written with in practice: a list of
 * blocks, optionally weighted. The field accepts free text for the rest, the same
 * bargain `RegistryPicker` makes, so nothing in the grammar is unreachable.
 *
 * Verified against WorldEdit's `RandomPatternParser`: entries are comma-separated,
 * a weight is `[0-9]+(\.[0-9]*)?` followed by `%`, and an entry without one counts
 * as 1. Weights are relative chances, **not** percentages — `50%stone,50%dirt` and
 * `1%stone,1%dirt` are the same pattern — so nothing here asks them to total 100.
 */
export interface PatternEntry {
  /** A block id. Registries hold them bare; WorldEdit takes a namespaced one too. */
  block: string
  /** Relative chance. Empty means unweighted, which WorldEdit reads as 1. */
  weight: number | ''
}

export interface PatternValue {
  entries: readonly PatternEntry[]
}

export const EMPTY_PATTERN: PatternValue = { entries: [] }

/** The registry a pattern's ids come from. Blocks, not items: `//generate` places blocks. */
export const PATTERN_REGISTRY = 'block'

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

/** Entries with an actual block in them. A half-added row is not part of the pattern. */
const filled = (value: PatternValue): readonly PatternEntry[] =>
  value.entries.filter((entry) => entry.block.trim() !== '')

export function serializePattern(value: PatternValue): string {
  const entries = filled(value)
  if (entries.length === 0) return ''

  // A weight on a lone entry is dropped rather than written. WorldEdit's
  // RandomPatternParser bails out on a single token — `if (patterns.size() == 1)
  // return null` — handing it to the plain block parser, which does not understand
  // `50%`. So `50%stone` on its own is not a pattern that favours stone; it is a
  // parse error. One entry is always 100% of itself anyway.
  if (entries.length === 1) return entries[0]!.block.trim()

  return entries
    .map(({ block, weight }) => (weight === '' ? block.trim() : `${weight}%${block.trim()}`))
    .join(',')
}

export function validatePattern(value: PatternValue, ctx: SerializeContext): Diagnostic[] {
  const entries = filled(value)
  const out: Diagnostic[] = []

  for (const { block } of entries) {
    if (!isKnownBlock(block, ctx)) out.push(warn(`${block.trim()} is not a block in this version.`))
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
