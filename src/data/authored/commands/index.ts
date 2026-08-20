import type { CommandDefinition } from '../../../schema/types'
import { generate } from './worldedit/generate'

/**
 * Commands written by hand rather than derived.
 *
 * Everything vanilla comes out of the Brigadier tree, so this holds what no data
 * source describes: WorldEdit, whose commands live in a plugin's Java annotations and
 * have no mcmeta equivalent. A hand-written *vanilla* definition would be legal here
 * too — `docs/command-schema.md` says `dialect` and `provenance` are independent —
 * but there is no reason to write one while derivation covers all 78.
 *
 * A flat list keyed by id, in the same shape the derived payload has, so the catalogue
 * can merge the two without either side knowing the other exists.
 */
const AUTHORED: readonly CommandDefinition[] = [generate]

export const authoredCommands: Readonly<Record<string, CommandDefinition>> = Object.fromEntries(
  AUTHORED.map((definition) => [definition.id, definition]),
)
