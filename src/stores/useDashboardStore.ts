import { create } from 'zustand'
import { DEFAULT_PLACED, PANELS, type PanelId } from '../components/dashboard/panels'
import { LAYOUT_VERSION, readLayout, writeLayout } from '../storage/preferences'

interface DashboardState {
  placed: readonly PanelId[]
  removed: readonly PanelId[]
  hydrated: boolean
  /** Read the stored arrangement. Safe to call repeatedly; only the first does work. */
  hydrate: () => void
  remove: (id: PanelId) => void
  restore: (id: PanelId) => void
}

const KNOWN = new Set<string>(PANELS.map((panel) => panel.id))

/**
 * Reconcile what was stored against what this build actually has.
 *
 * Three rules, and the first is the one that is easy to get wrong:
 *
 * - **A panel in neither list is new to this user, and goes in.** A stored list is a
 *   record of decisions taken, not an allowlist. Without this, adding a fourth panel in
 *   a later build would make it invisible to everyone who had ever loaded the app —
 *   silently, and forever.
 * - A panel in `removed` stays removed. That was a decision.
 * - An **unknown** id is dropped rather than kept, and dropping it is not a reason to
 *   discard the layout. This is the same skip-the-entry-not-the-file rule the saved
 *   command reader follows, applied to the second persisted thing in the app.
 */
function reconcile(stored: ReturnType<typeof readLayout>): {
  placed: PanelId[]
  removed: PanelId[]
} {
  if (!stored) return { placed: [...DEFAULT_PLACED], removed: [] }

  const removed = stored.removed.filter((id): id is PanelId => KNOWN.has(id))
  const removedSet = new Set<string>(removed)
  const placed = stored.placed.filter((id): id is PanelId => KNOWN.has(id) && !removedSet.has(id))

  const seen = new Set<string>([...placed, ...removed])
  for (const panel of PANELS) {
    if (!seen.has(panel.id)) placed.push(panel.id)
  }

  return { placed, removed }
}

function persist(placed: readonly PanelId[], removed: readonly PanelId[]): void {
  writeLayout({ version: LAYOUT_VERSION, placed: [...placed], removed: [...removed] })
}

/**
 * Which dashboard panels are on screen, and in what order.
 *
 * Separate from `useUiStore`, which holds only the transient rect an animation grows
 * from. This outlives a reload; that does not, and merging them would give one store
 * two lifetimes.
 *
 * No `zustand/persist` middleware — it is not a dependency, and the reconciliation
 * above is the interesting half anyway. A middleware would rehydrate the stored list
 * verbatim, which is precisely the behaviour that makes a newly added panel invisible.
 */
export const useDashboardStore = create<DashboardState>((set, get) => ({
  placed: DEFAULT_PLACED,
  removed: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    const { placed, removed } = reconcile(readLayout())
    set({ placed, removed, hydrated: true })
  },

  remove: (id) => {
    const placed = get().placed.filter((panel) => panel !== id)
    const removed = get().removed.includes(id) ? get().removed : [...get().removed, id]
    set({ placed, removed })
    persist(placed, removed)
  },

  restore: (id) => {
    if (get().placed.includes(id)) return
    // Appended rather than returned to its original index. Where it *was* is not
    // recorded, and inventing a position would be a guess the user then has to undo.
    const placed = [...get().placed, id]
    const removed = get().removed.filter((panel) => panel !== id)
    set({ placed, removed })
    persist(placed, removed)
  },
}))
