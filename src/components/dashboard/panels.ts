import type { SavedCommand } from '../../schema/saved'

export type PanelId = 'saved' | 'recent' | 'quick' | 'pinned'

interface BasePanel {
  id: PanelId
  title: string
  /** What it says when the view is empty. A panel is never a blank box. */
  empty: string
}

/**
 * A panel that is a lens over the one saved-commands list.
 *
 * A **view**, never a store. Saved, Recent and Quick all read the same array, so a
 * command can appear in more than one at once — which is right: these are lenses on a
 * collection, not folders it is filed into. Nothing is duplicated, nothing has to be
 * kept in step, and deleting a command removes it from all three by construction.
 */
export interface CommandPanel extends BasePanel {
  source: 'commands'
  select: (commands: readonly SavedCommand[]) => readonly SavedCommand[]
}

/**
 * A panel over the pinned *generators* — the commands a person builds often, rather
 * than the ones they have already built.
 *
 * It carries no `select`, and that is the honest shape rather than an omission. The
 * other three answer a question about a list the dashboard already holds; this one
 * reads a different collection entirely (`usePinnedGeneratorsStore`), which is why the
 * two are a union here instead of one interface with an optional field. A `select` that
 * ignored its argument would be a lie with a type signature.
 */
export interface GeneratorPanel extends BasePanel {
  source: 'generators'
}

export type PanelDescriptor = CommandPanel | GeneratorPanel

/** How many a Recent panel shows before it stops being "recent". */
const RECENT_LIMIT = 8

export const PANELS: readonly PanelDescriptor[] = [
  {
    id: 'pinned',
    source: 'generators',
    title: 'Pinned generators',
    // First, because it is the only panel that is about starting something. The other
    // three are about what already exists, and a dashboard that opens with a list of
    // finished work buries the way to make more of it.
    empty: 'Pin a generator from the command list to start one without searching.',
  },
  {
    id: 'saved',
    source: 'commands',
    title: 'Saved commands',
    // Identity. The store already sorts newest-`updatedAt` first with an id tiebreak;
    // re-sorting here would be a second opinion on the same question.
    select: (commands) => commands,
    empty: 'Nothing saved yet. Build a command and keep it here.',
  },
  {
    id: 'recent',
    source: 'commands',
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
    source: 'commands',
    title: 'Quick',
    select: (commands) => commands.filter((command) => command.pinned === true),
    empty: 'Pin a command to keep it here.',
  },
]

/** Every panel, placed, in the order they are drawn on a dashboard nobody has touched. */
export const DEFAULT_PLACED: readonly PanelId[] = ['pinned', 'saved', 'recent', 'quick']

export function panelById(id: PanelId): PanelDescriptor | undefined {
  return PANELS.find((panel) => panel.id === id)
}
