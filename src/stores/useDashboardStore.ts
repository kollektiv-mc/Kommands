import { create } from 'zustand'
import { DEFAULT_PLACED, PANELS, type PanelId } from '../components/dashboard/panels'
import { LAYOUT_VERSION, readLayout, writeLayout } from '../storage/preferences'
import { moveTo } from '../lib/reorder'

interface DashboardState {
  placed: readonly PanelId[]
  removed: readonly PanelId[]
  /**
   * The panels currently closed.
   *
   * Held apart from `placed` rather than as a flag on it, because closed and placed are
   * orthogonal — a closed panel is still on the dashboard, and folding the two together
   * would make removing a closed panel and restoring it quietly reopen it.
   */
  collapsed: readonly PanelId[]
  /** Saved command ids in the order they were dragged into. See `arrange`. */
  order: readonly string[]
  /** Group names the browser offers, nothing filed under them or not. */
  groups: readonly string[]
  hydrated: boolean
  /** Read the stored arrangement. Safe to call repeatedly; only the first does work. */
  hydrate: () => void
  remove: (id: PanelId) => void
  restore: (id: PanelId) => void
  /** Open a closed panel, or close an open one. */
  toggleCollapsed: (id: PanelId) => void
  /** Move `from` to where `to` is, given the ids in the order they are shown now. */
  reorder: (shown: readonly string[], from: string, to: string) => void
  /** Offer a new group in the browser. A blank or known name does nothing. */
  addGroup: (name: string) => void
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
  collapsed: PanelId[]
} {
  if (!stored) return { placed: [...DEFAULT_PLACED], removed: [], collapsed: [] }

  const removed = stored.removed.filter((id): id is PanelId => KNOWN.has(id))
  const removedSet = new Set<string>(removed)
  const placed = stored.placed.filter((id): id is PanelId => KNOWN.has(id) && !removedSet.has(id))

  const seen = new Set<string>([...placed, ...removed])
  for (const panel of PANELS) {
    if (!seen.has(panel.id)) placed.push(panel.id)
  }

  // A new panel arrives open, which is the same rule the first bullet above states for
  // `placed`: a stored list records decisions taken, and nobody has decided to close a
  // panel they have never seen. Filtered to what is placed for the same reason — a
  // collapse flag on a removed panel describes nothing, and keeping it would let the
  // list grow entries no reader can ever act on.
  const placedSet = new Set<string>(placed)
  const collapsed = (stored.collapsed ?? []).filter((id): id is PanelId => placedSet.has(id))

  return { placed, removed, collapsed }
}

function persist(state: DashboardState): void {
  writeLayout({
    version: LAYOUT_VERSION,
    placed: [...state.placed],
    removed: [...state.removed],
    collapsed: [...state.collapsed],
    order: [...state.order],
    groups: [...state.groups],
  })
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
  collapsed: [],
  order: [],
  groups: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    const stored = readLayout()
    const { placed, removed, collapsed } = reconcile(stored)
    set({
      placed,
      removed,
      collapsed,
      order: stored?.order ?? [],
      groups: stored?.groups ?? [],
      hydrated: true,
    })
  },

  remove: (id) => {
    const placed = get().placed.filter((panel) => panel !== id)
    const removed = get().removed.includes(id) ? get().removed : [...get().removed, id]
    // Dropped rather than remembered. A panel removed while closed and later restored
    // should come back showing what is in it — that is the whole reason someone
    // restores one — and `AddPanelMenu` gives no hint that what returns will be shut.
    const collapsed = get().collapsed.filter((panel) => panel !== id)
    set({ placed, removed, collapsed })
    persist({ ...get(), placed, removed, collapsed })
  },

  restore: (id) => {
    if (get().placed.includes(id)) return
    // Appended rather than returned to its original index. Where it *was* is not
    // recorded, and inventing a position would be a guess the user then has to undo.
    const placed = [...get().placed, id]
    const removed = get().removed.filter((panel) => panel !== id)
    set({ placed, removed })
    persist({ ...get(), placed, removed })
  },

  toggleCollapsed: (id) => {
    const closed = get().collapsed.includes(id)
    const collapsed = closed
      ? get().collapsed.filter((panel) => panel !== id)
      : [...get().collapsed, id]
    set({ collapsed })
    persist({ ...get(), collapsed })
  },

  reorder: (shown, from, to) => {
    const order = moveTo(shown, shown.indexOf(from), shown.indexOf(to))
    if (order === shown) return
    set({ order })
    persist({ ...get(), order })
  },

  addGroup: (name) => {
    const clean = name.trim()
    if (clean === '' || get().groups.includes(clean)) return
    const groups = [...get().groups, clean]
    set({ groups })
    persist({ ...get(), groups })
  },
}))
