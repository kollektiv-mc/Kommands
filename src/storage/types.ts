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

/**
 * The format version this build **writes**. It is not a gate the reader applies.
 *
 * `persistence.md` requires the marker from the first commit, and it earns its place:
 * it lets a future reader tell an old shape from a corrupt one. What it must not do is
 * decide whether to read the file, and the reader no longer consults it — see
 * `local.ts` § read.
 *
 * So bump it only when an entry this build writes could not be understood by re-reading
 * it under the older rules — a re-keying of the value tree, say. **Not for a new
 * field.** Adding `fingerprint`, `pinned` and `lastOpenedAt` did not bump it, because
 * an older build reads their absence correctly and carries their presence through
 * untouched, and because Konnekt is on a different release cycle: a number it does not
 * recognise is exactly the "one new field breaks every linked command at once" failure
 * the health checklist names.
 */
export const FORMAT_VERSION = 1
