import type { SavedCommand, StructureState } from '../../schema/saved'
import { resumability } from '../../schema/saved'
import { findVersion } from '../../data/versions'
import { v1_21_1 } from '../../data/versions/1.21.1'

/** What the three resumability answers say about a tile. */
const RESUMABILITY_NOTE = {
  ready: null,
  retraited: 'Authored for a version that writes this differently',
  'unknown-version': 'Authored for a version this build does not know',
} as const

/** What the structural verdict says about a tile. The editor says it in full on open. */
const STRUCTURE_NOTE = {
  verified: null,
  stale: 'Saved against an older shape of this command: opens empty',
  'unknown-command': 'The command this was built for is not in this build',
  unverified: 'Saved before Kommands recorded command shapes: opens empty',
} as const

/**
 * Why a saved command will not reopen as saved, or null when it will.
 *
 * Version outranks structure. The fingerprint index describes the active version's
 * definitions, so for a command authored against another version the structural verdict
 * compares across two catalogues and is not evidence. `structure` is undefined while the
 * index loads, which is the one case with nothing to say yet.
 */
export function tileNote(saved: SavedCommand, structure: StructureState | undefined) {
  const version = resumability(saved, v1_21_1, findVersion)
  if (version !== 'ready') return RESUMABILITY_NOTE[version]
  return structure ? STRUCTURE_NOTE[structure] : null
}
