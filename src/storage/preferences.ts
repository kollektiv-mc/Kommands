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
