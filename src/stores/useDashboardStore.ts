import { create } from 'zustand'
import { PANELS, type PanelId } from '../components/dashboard/panels'
import { LAYOUT_VERSION, readLayout, writeLayout } from '../storage/preferences'
import { moveTo } from '../lib/reorder'

interface DashboardState {
  /** The panels currently closed. Every panel is always on the dashboard. */
  collapsed: readonly PanelId[]
  /** Saved command ids in the order they were dragged into. See `arrange`. */
  order: readonly string[]
  /** Group names the browser offers, nothing filed under them or not. */
  groups: readonly string[]
  hydrated: boolean
  /** Read the stored arrangement. Safe to call repeatedly; only the first does work. */
  hydrate: () => void
  /** Open a closed panel, or close an open one. */
  toggleCollapsed: (id: PanelId) => void
  /** Move `from` to where `to` is, given the ids in the order they are shown now. */
  reorder: (shown: readonly string[], from: string, to: string) => void
  /** Offer a new group in the browser. A blank or known name does nothing. */
  addGroup: (name: string) => void
}

const KNOWN = new Set<string>(PANELS.map((panel) => panel.id))

function persist(state: DashboardState): void {
  writeLayout({
    version: LAYOUT_VERSION,
    collapsed: [...state.collapsed],
    order: [...state.order],
    groups: [...state.groups],
  })
}

/**
 * How the dashboard was arranged: which panels are closed, the saved tiles' order, and
 * the browser's groups.
 *
 * Separate from `useUiStore`, which holds only the transient rect an animation grows
 * from. This outlives a reload; that does not, and merging them would give one store
 * two lifetimes.
 */
export const useDashboardStore = create<DashboardState>((set, get) => ({
  collapsed: [],
  order: [],
  groups: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    const stored = readLayout()
    set({
      // An unknown id is dropped rather than kept, and dropping it is not a reason to
      // discard the layout: the skip-the-entry-not-the-file rule the saved command
      // reader follows. A panel added in a later build is in no list, so it arrives open.
      collapsed: (stored?.collapsed ?? []).filter((id): id is PanelId => KNOWN.has(id)),
      order: stored?.order ?? [],
      groups: stored?.groups ?? [],
      hydrated: true,
    })
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
