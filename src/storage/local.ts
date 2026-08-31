import type { SavedCommand } from '../schema/saved'
import { FORMAT_VERSION, type SavedCommandFile, type SavedCommandStorage } from './types'

/** The one key this app writes. Namespaced, because a browser origin is shared. */
export const STORAGE_KEY = 'kommands.saved-commands'

/**
 * Whether an unknown value is a `SavedCommand`.
 *
 * Structural rather than trusting: what comes back from `localStorage` is a string
 * this app wrote *at some point*, which is not the same as a string this build's
 * schema wrote. A hand-edited value, a half-finished write, or a command stored by a
 * future version are all reachable, and none of them should take the dashboard down.
 *
 * The value tree's *interior* is deliberately not validated. It is keyed by paths that
 * only mean something against a definition this function has never seen, so anything
 * it could check would be a guess — and the schema layer already answers the real
 * question through `resumability`. What is checked here is that the envelope is
 * present and the right shape.
 */
function isSavedCommand(value: unknown): value is SavedCommand {
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

/** Everything in the store, with anything unreadable dropped rather than thrown. */
function read(backing: Storage): SavedCommand[] {
  const raw = backing.getItem(STORAGE_KEY)
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // A corrupt blob costs the user their saved commands, which is bad. Throwing here
    // costs them the dashboard *and* their saved commands, and leaves no way back to a
    // working app short of clearing site data by hand.
    return []
  }

  if (typeof parsed !== 'object' || parsed === null) return []
  const file = parsed as Partial<SavedCommandFile>
  if (!Array.isArray(file.commands)) return []
  // `file.version` is deliberately **not** consulted. This used to refuse a whole file
  // whose envelope version it did not recognise, on the reasoning that reading a future
  // shape would drop the fields it did not know about and write that loss back. That
  // reasoning was wrong, and `health-checklist.md` now forbids the behaviour outright:
  // a reader skips an entry it does not understand rather than rejecting the file.
  //
  // Wrong because `filter` is not `map`. It returns the parsed objects with their
  // unknown properties intact, `write` stringifies them whole, and every mutation in
  // `saved.ts` is a spread — so a field this build has never heard of survives a read,
  // an edit and a write back. Preservation is structural rather than lucky, which is
  // what makes per-entry acceptance safe rather than a trade.
  //
  // The cost of the old rule was not hypothetical either: one build refusing another's
  // file empties the dashboard silently, and on the standalone backend that file is the
  // one Konnekt reads.
  return file.commands.filter(isSavedCommand)
}

function write(backing: Storage, commands: readonly SavedCommand[]): void {
  const file: SavedCommandFile = { version: FORMAT_VERSION, commands: [...commands] }
  backing.setItem(STORAGE_KEY, JSON.stringify(file))
}

/**
 * Saved commands in `localStorage`: per-browser, no sync, and that is fine.
 *
 * `backing` is a parameter so a test can hand it a real `Storage` without reaching for
 * a global.
 *
 * The methods are `async` rather than returning `Promise.resolve(…)`, which is not a
 * stylistic choice: `setItem` throws synchronously when the quota is exceeded or the
 * browser is refusing storage, and a hand-built promise would let that throw escape
 * past the caller's `.catch()` as a synchronous exception. A rejected promise is what
 * the interface promises, and a failed write must reach the caller — reporting a save
 * that did not happen is the one outcome worse than failing to save.
 */
export function localStorageBackend(backing: Storage = localStorage): SavedCommandStorage {
  return {
    kind: 'local',
    async list() {
      return read(backing)
    },
    async put(saved) {
      const existing = read(backing)
      const index = existing.findIndex((held) => held.id === saved.id)
      if (index === -1) existing.push(saved)
      else existing[index] = saved
      write(backing, existing)
    },
    async remove(id) {
      write(
        backing,
        read(backing).filter((held) => held.id !== id),
      )
    },
  }
}
