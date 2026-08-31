/**
 * Small, local, disposable UI preferences.
 *
 * **Deliberately not `SavedCommandStorage`.** Different key, different lifetime, and —
 * the part that matters — it never enters the file the standalone build shares with
 * Konnekt. `persistence.md` is about formats that outlive the build that wrote them and
 * cross into another application; this is which panels a person left on their
 * dashboard. Routing it through the saved-command backend would put a layout
 * preference into a cross-repo compatibility surface for no reason at all.
 *
 * That is also why it is not exported from `src/storage/index.ts`: that module's whole
 * job is to make the *one* backend decision, and a second thing exported beside it
 * invites the two to be confused.
 *
 * Failure is silent in both directions, which is the opposite of the saved-command
 * rules and correct for the same underlying reason. A save that silently did nothing is
 * worse than one that failed loudly, because the user loses work they can see. A lost
 * panel arrangement costs a rearrangement nobody was asked to do; surfacing it would be
 * an error message about something that does not matter.
 */
const KEY = 'kommands.dashboard-layout'

export interface StoredLayout {
  version: number
  placed: string[]
  removed: string[]
}

export const LAYOUT_VERSION = 1

/** The stored layout, or null if there is none, it is unreadable, or storage is refused. */
export function readLayout(): StoredLayout | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const layout = parsed as Partial<StoredLayout>
    if (!Array.isArray(layout.placed) || !Array.isArray(layout.removed)) return null
    return {
      version: typeof layout.version === 'number' ? layout.version : LAYOUT_VERSION,
      placed: layout.placed.filter((id): id is string => typeof id === 'string'),
      removed: layout.removed.filter((id): id is string => typeof id === 'string'),
    }
  } catch {
    return null
  }
}

export function writeLayout(layout: StoredLayout): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(layout))
  } catch {
    // See the module comment. There is nothing worth saying about this.
  }
}

/**
 * The three preferences below share this module's contract, not the saved-command one:
 * local, disposable, silent on failure, and never part of the file Konnekt reads. They
 * are separate keys rather than one blob because they have nothing to do with each
 * other, and a single key would make a malformed layout cost someone their theme.
 */
const THEME_KEY = 'kommands.theme'
const PINNED_KEY = 'kommands.pinned-generators'

/** The stored theme, or null when none was chosen or storage is refused. */
export function readTheme(): 'dark' | 'light' | null {
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    return null
  }
}

export function writeTheme(theme: 'dark' | 'light'): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // See the module comment. There is nothing worth saying about this.
  }
}

/**
 * A pinned command generator, as the dashboard needs it.
 *
 * The **label travels with the id**, and that is the whole design. The dashboard never
 * loads the catalogue — `routes/index.tsx` says why: 560 KB of command skeletons and
 * 668 KB of registries are not things the app's first screen may reach for, which is
 * also why a saved command caches its `preview` string. Resolving a pinned id to a
 * label at render time would undo that in one line.
 *
 * So the label is snapshotted where the catalogue is already in hand — the command
 * navbar — exactly as `preview` is snapshotted where the serializer is. A label that
 * later changes upstream leaves a stale word on a tile until it is re-pinned, which is
 * the same trade `preview` makes and the same small one.
 */
export interface PinnedGenerator {
  id: string
  label: string
}

/** The pinned generators, oldest pin first. Empty when there are none or storage is refused. */
export function readPinnedGenerators(): PinnedGenerator[] {
  try {
    const raw = window.localStorage.getItem(PINNED_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Entry-wise, not file-wise: one malformed record drops itself rather than the
    // whole list. Same rule the saved-command reader follows, for the same reason.
    return parsed.filter(
      (entry): entry is PinnedGenerator =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PinnedGenerator).id === 'string' &&
        typeof (entry as PinnedGenerator).label === 'string',
    )
  } catch {
    return []
  }
}

export function writePinnedGenerators(pinned: readonly PinnedGenerator[]): void {
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(pinned))
  } catch {
    // See the module comment.
  }
}
