import type { SavedCommand } from '../../schema/saved'

export type PanelId = 'saved' | 'recent' | 'quick'

export interface PanelDescriptor {
  id: PanelId
  title: string
  /**
   * How the one list of saved commands becomes this panel's list.
   *
   * A **view**, never a store. All three panels read the same array, so a command can
   * appear in more than one at once — which is right: these are lenses on a collection,
   * not folders it is filed into. Nothing is duplicated, nothing has to be kept in
   * step, and deleting a command removes it from all three by construction.
   */
  select: (commands: readonly SavedCommand[]) => readonly SavedCommand[]
  /** What it says when the view is empty. A panel is never a blank box. */
  empty: string
}

/** How many a Recent panel shows before it stops being "recent". */
const RECENT_LIMIT = 8

export const PANELS: readonly PanelDescriptor[] = [
  {
    id: 'saved',
    title: 'Saved commands',
    // Identity. The store already sorts newest-`updatedAt` first with an id tiebreak;
    // re-sorting here would be a second opinion on the same question.
    select: (commands) => commands,
    empty: 'Nothing saved yet. Build a command and keep it here.',
  },
  {
    id: 'recent',
    title: 'Recent',
    // The filter is load-bearing rather than decorative: a command that has never been
    // opened is not recent, and without it this panel would be Saved again in a
    // different order. `lastOpenedAt` is absent until a command is actually opened.
    select: (commands) =>
      commands
        .filter((command) => command.lastOpenedAt !== undefined)
        .toSorted((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
        .slice(0, RECENT_LIMIT),
    empty: 'Commands you open will show up here.',
  },
  {
    id: 'quick',
    title: 'Quick',
    select: (commands) => commands.filter((command) => command.pinned === true),
    empty: 'Pin a command to keep it here.',
  },
]

/** Every panel, placed, in the order they are drawn on a dashboard nobody has touched. */
export const DEFAULT_PLACED: readonly PanelId[] = ['saved', 'recent', 'quick']

export function panelById(id: PanelId): PanelDescriptor | undefined {
  return PANELS.find((panel) => panel.id === id)
}
