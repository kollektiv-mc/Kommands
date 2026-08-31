import { fileBackend } from './file'
import { localStorageBackend } from './local'
import { probedBackend } from './probe'
import type { SavedCommandStorage } from './types'

export type { SavedCommandStorage, SavedCommandFile } from './types'
export { FORMAT_VERSION } from './types'
export { localStorageBackend, STORAGE_KEY } from './local'
export { fileBackend } from './file'
export { commandsFromEnvelope, isSavedCommand } from './entries'
export { probeLocalBackend, probedBackend, configureProbe, type LocalBackend } from './probe'

/**
 * The backend this session stores saved commands in.
 *
 * **The one place the choice is made.** #42 asked for an interface with two
 * implementations decided once at startup rather than a branch at each call site, and
 * this function is that decision — the `if` below is the whole of what the standalone
 * build changes in `src/`, exactly as promised when the interface landed.
 *
 * The file backend wins whenever the capabilities probe found a local backend, which
 * covers both surfaces of the local install — the webview and the `--serve` browser
 * session — and never the hosted site, where the probe has nothing to find. The probe
 * ran before first render (`main.tsx`), so reading it here is synchronous and the
 * answer cannot change while the app is running.
 *
 * Returns `null` rather than throwing when storage is unavailable. That is a real
 * state, not a defensive flourish — Safari's private browsing and any browser
 * configured to block site data make even *reading* `window.localStorage` throw — and
 * a generator that still generates commands is far more useful than a blank page. The
 * caller's job is to say saving is off, not to fall over. The file backend has no
 * equivalent case: if the probe answered, the backend is there.
 */
export function resolveStorage(): SavedCommandStorage | null {
  if (probedBackend() !== null) return fileBackend()
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
