import type { SavedCommand } from '../schema/saved'

/**
 * Where saved commands live.
 *
 * An interface with one implementation today and a second one coming, rather than a
 * `localStorage` call at each site that needs one. The standalone desktop build
 * (#44) stores its saved commands in a JSON file under `os.UserConfigDir()/kommands`
 * — which is also the file Konnekt reads (#45) — and that swap should be one line in
 * `resolveStorage`, not a branch in every caller.
 *
 * Every method is async even though the web implementation answers synchronously.
 * The file backend cannot, and an interface that was sync-shaped first would make
 * adding it a change to every caller instead of a change here.
 */
export interface SavedCommandStorage {
  /**
   * Which backend this is.
   *
   * Read by the UI rather than inferred: only the standalone build can participate in
   * linking with Konnekt, and #42 asks for that split to be visible to the user rather
   * than discovered when a link silently fails to appear.
   */
  readonly kind: 'local' | 'file'
  /** Everything stored, in no guaranteed order. */
  list(): Promise<readonly SavedCommand[]>
  /** Insert or replace by id. */
  put(saved: SavedCommand): Promise<void>
  /** Remove by id. Removing an absent id is not an error. */
  remove(id: string): Promise<void>
}

/**
 * The persisted envelope.
 *
 * The commands travel inside a versioned wrapper rather than as a bare array, so a
 * later change to `SavedCommand` can be migrated instead of guessed at. A bare array
 * would leave a reader unable to tell an old shape from a corrupt one.
 */
export interface SavedCommandFile {
  version: number
  commands: SavedCommand[]
}

/** The format version this build writes. Bump it when `SavedCommand` changes shape. */
export const FORMAT_VERSION = 1
