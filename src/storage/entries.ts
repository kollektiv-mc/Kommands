import type { SavedCommand } from '../schema/saved'
import type { SavedCommandFile } from './types'

/**
 * Whether an unknown value is a `SavedCommand`.
 *
 * Structural rather than trusting: what a backend hands back is something this app
 * wrote *at some point*, which is not the same as something this build's schema wrote.
 * A hand-edited value, a half-finished write, or a command stored by a future version
 * are all reachable, and none of them should take the dashboard down.
 *
 * One function for both backends on purpose — the `localStorage` envelope and the
 * standalone's `store.json` are one format in two places (`persistence.md` § Where it
 * is stored), so what counts as a readable entry must not depend on which of them
 * answered.
 *
 * The value tree's *interior* is deliberately not validated. It is keyed by paths that
 * only mean something against a definition this function has never seen, so anything
 * it could check would be a guess — and the schema layer already answers the real
 * question through `resumability`. What is checked here is that the envelope is
 * present and the right shape.
 */
export function isSavedCommand(value: unknown): value is SavedCommand {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const tree = candidate.value
  if (typeof tree !== 'object' || tree === null) return false
  const tables = tree as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.definitionId === 'string' &&
    typeof candidate.version === 'string' &&
    typeof candidate.preview === 'string' &&
    typeof candidate.revision === 'number' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    ['args', 'flags', 'choices', 'repeats', 'refs'].every(
      (table) => typeof tables[table] === 'object' && tables[table] !== null,
    )
  )
}

/**
 * The commands inside a parsed envelope, with anything unreadable dropped.
 *
 * The envelope's `version` is deliberately **not** consulted. This used to refuse a
 * whole file whose envelope version it did not recognise, on the reasoning that
 * reading a future shape would drop the fields it did not know about and write that
 * loss back. That reasoning was wrong, and `health-checklist.md` now forbids the
 * behaviour outright: a reader skips an entry it does not understand rather than
 * rejecting the file.
 *
 * Wrong because `filter` is not `map`. It returns the parsed objects with their
 * unknown properties intact, both backends write them back whole, and every mutation
 * in `saved.ts` is a spread — so a field this build has never heard of survives a
 * read, an edit and a write back. Preservation is structural rather than lucky, which
 * is what makes per-entry acceptance safe rather than a trade.
 *
 * The cost of the old rule was not hypothetical either: one build refusing another's
 * file empties the dashboard silently, and on the standalone backend that file feeds
 * the projection Konnekt reads.
 */
export function commandsFromEnvelope(parsed: unknown): SavedCommand[] {
  if (typeof parsed !== 'object' || parsed === null) return []
  const file = parsed as Partial<SavedCommandFile>
  if (!Array.isArray(file.commands)) return []
  return file.commands.filter(isSavedCommand)
}
