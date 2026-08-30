import { localStorageBackend } from './local'
import type { SavedCommandStorage } from './types'

export type { SavedCommandStorage, SavedCommandFile } from './types'
export { FORMAT_VERSION } from './types'
export { localStorageBackend, STORAGE_KEY } from './local'

/**
 * The backend this build stores saved commands in.
 *
 * **The one place the choice is made.** #42 asks for an interface with two
 * implementations decided once at startup rather than a branch at each call site, and
 * this function is that decision: when the standalone desktop build lands (#44), its
 * file backend is an `if` here and nothing else in `src/` changes.
 *
 * Returns `null` rather than throwing when storage is unavailable. That is a real
 * state, not a defensive flourish — Safari's private browsing and any browser
 * configured to block site data make even *reading* `window.localStorage` throw — and
 * a generator that still generates commands is far more useful than a blank page. The
 * caller's job is to say saving is off, not to fall over.
 */
export function resolveStorage(): SavedCommandStorage | null {
  try {
    // Touched, not merely referenced: the throw happens on property access, and an
    // unused reference is exactly what a minifier is entitled to remove.
    const backing = window.localStorage
    backing.getItem('kommands.probe')
    return localStorageBackend(backing)
  } catch {
    return null
  }
}
