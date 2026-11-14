import { parsePattern, serializePattern } from '../../schema/argument-types/we-pattern'

/**
 * The block mix: the Blocks pattern as a list, one row per block with its chance. It
 * edits the same text as the Blocks field, so either can be used.
 *
 * Chances are written as `n%block`, WorldEdit's weighted form. WorldEdit reads them as
 * relative, so they need not add up to 100; Add block only starts them that way.
 */
export interface MixRow {
  /** Stable while the mix is open, so a row keeps its fields as others go. */
  key: number
  block: string
  /** As typed: digits and a point, or empty for an unweighted block. */
  chance: string
}

let next = 0
const row = (block: string, chance: string): MixRow => ({ key: ++next, block, chance })

/** The pattern's rows; an empty pattern is one empty row to type into. */
export function readMix(pattern: string): MixRow[] {
  const rows = parsePattern(pattern).entries.map((e) => row(e.block, String(e.weight)))
  return rows.length > 0 ? rows : [row('', '')]
}

/** The pattern the rows make. A row with no block is not part of it yet. */
export function writeMix(rows: readonly MixRow[]): string {
  return serializePattern({
    entries: rows.map((r) => ({
      block: r.block,
      weight: r.chance === '' || !Number.isFinite(Number(r.chance)) ? '' : Number(r.chance),
    })),
  })
}

/** Digits and a point only, as the chance field takes them. */
export const chanceText = (typed: string): string => typed.replace(/[^\d.]/g, '')

/**
 * The rows with a new, empty one on the end, every chance shared out evenly to make
 * 100; the first takes what does not divide. Rows still empty are dropped first.
 */
export function addRow(rows: readonly MixRow[]): MixRow[] {
  const kept = [...rows.filter((r) => r.block.trim() !== ''), row('', '')]
  const each = Math.floor(100 / kept.length)
  return kept.map((r, i) => ({
    ...r,
    chance: String(i === 0 ? 100 - each * (kept.length - 1) : each),
  }))
}
