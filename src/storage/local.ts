import type { SavedCommand } from '../schema/saved'
import { commandsFromEnvelope } from './entries'
import { FORMAT_VERSION, type SavedCommandFile, type SavedCommandStorage } from './types'

/** The one key this app writes. Namespaced, because a browser origin is shared. */
export const STORAGE_KEY = 'kommands.saved-commands'

/**
 * Everything in the store, with anything unreadable dropped rather than thrown.
 *
 * What counts as readable — per entry, never per file — is `entries.ts`, shared with
 * the standalone's file backend so the two cannot drift on it.
 */
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

  return commandsFromEnvelope(parsed)
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
