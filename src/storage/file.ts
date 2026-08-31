import { commandsFromEnvelope } from './entries'
import type { SavedCommandStorage } from './types'

/**
 * Saved commands over the local backend's HTTP API — the standalone's storage.
 *
 * A thin client on purpose: the shell owns the files (the canonical `store.json` and
 * the projection Konnekt reads — `persistence.md` § The shared file), the atomicity
 * rules and the cross-surface locking, so this module's whole job is to speak the
 * `SavedCommandStorage` contract to `/api/saved-commands`. Mutations are per-command
 * (`PUT`/`DELETE` by id) rather than whole-file, because two surfaces of the local
 * install can write concurrently and the read-modify-write has to happen where the
 * lock is — in the one Go process — not in whichever surface read last.
 *
 * Errors are thrown with the backend's own message where it sent one. The store holds
 * them as its `error` state, exactly as it does for a quota-exceeded `localStorage`
 * write — a failed save must reach the caller, and the 500 a corrupt store answers
 * with is the honest alternative to an empty list that invites a destructive rewrite.
 */

const BASE = '/api/saved-commands'

/** The backend's error message, or the status line when it did not send one. */
async function failure(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null) {
      const message = (body as Record<string, unknown>).error
      if (typeof message === 'string' && message !== '') return message
    }
  } catch {
    // Not JSON — fall through to the status line.
  }
  return `the local backend answered ${response.status}`
}

/**
 * `fetcher` is a parameter for the same reason `localStorageBackend` takes `backing`:
 * a test hands in its own and exercises the real code path. The default wraps the
 * global rather than aliasing it, because an unbound `fetch` reference throws in
 * browsers that insist on their own `this`.
 */
export function fileBackend(
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = (input, init) =>
    fetch(input, init),
): SavedCommandStorage {
  return {
    kind: 'file',
    async list() {
      const response = await fetcher(BASE)
      if (!response.ok) throw new Error(await failure(response))
      // Per-entry acceptance, shared with the web backend: the file can hold entries
      // a future build wrote, and they are skipped here while surviving on disk.
      return commandsFromEnvelope(await response.json())
    },
    async put(saved) {
      const response = await fetcher(`${BASE}/${encodeURIComponent(saved.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
      })
      if (!response.ok) throw new Error(await failure(response))
    },
    async remove(id) {
      const response = await fetcher(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
      // Removing an absent id is a 204 on the backend, so anything not-ok here is a
      // real failure, not a "was already gone".
      if (!response.ok) throw new Error(await failure(response))
    },
  }
}
