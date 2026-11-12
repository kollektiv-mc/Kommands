import { useState } from 'react'
import type { SavedCommand, StructureState } from '../../schema/saved'
import { structureStateFromIndex } from '../../schema/saved'
import { fit, paginate } from '../../lib/paging'
import { useElementSize } from '../../lib/useElementSize'
import { SavedCommandTile } from '../SavedCommandTile'
import { tileNote } from './notes'
import { Icon } from '../ui/Icon'
import { DashboardPanel } from './DashboardPanel'
import { Pager } from './Pager'
import { SavedBrowser } from './SavedBrowser'

/** A tile's least width and natural height with a two-line console, and the grid gap, in px. */
const TILE_WIDTH = 230
const TILE_HEIGHT = 136
const GAP = 10
/** The grid's padding on each side, in px (p-3). */
const PAD = 12
/** Never more than four rows, however tall the window. */
const MAX_ROWS = 4

export interface SavedActions {
  onEdit: (saved: SavedCommand, element: HTMLElement) => void
  onRemove: (id: string) => void
  onPin: (saved: SavedCommand) => void
  onLink: (saved: SavedCommand) => void
  onReorder: (shown: readonly string[], from: string, to: string) => void
  onGroup: (id: string, group: string | undefined) => void
  onTags: (id: string, tags: readonly string[]) => void
  onAddGroup: (name: string) => void
}

/**
 * Saved commands: a grid of tiles that pages to fit the panel, and the browser that
 * slides up over it.
 *
 * As many columns as fit at `TILE_WIDTH`, and up to four rows of `TILE_HEIGHT`. A
 * shorter window shows fewer rows rather than clipping a tile.
 */
export function SavedPanel({
  commands,
  groups,
  fingerprints,
  linkable,
  collapsed,
  onToggle,
  actions,
}: {
  /** Already in the order they were dragged into. */
  commands: readonly SavedCommand[]
  groups: readonly string[]
  /** The fingerprint index, or null while it loads. */
  fingerprints: Readonly<Record<string, string>> | null
  linkable: boolean
  collapsed: boolean
  onToggle: () => void
  actions: SavedActions
}) {
  const [measure, size] = useElementSize<HTMLDivElement>()
  const [page, setPage] = useState(0)
  const [browsing, setBrowsing] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const cols = size ? fit(size.width - 2 * PAD, TILE_WIDTH, GAP) : 4
  const rows = size ? Math.min(MAX_ROWS, fit(size.height - 2 * PAD, TILE_HEIGHT, GAP)) : MAX_ROWS
  const shown = paginate(commands, cols * rows, page)
  const ids = commands.map((c) => c.id)

  const structure = (saved: SavedCommand): StructureState | undefined =>
    fingerprints ? structureStateFromIndex(saved, fingerprints) : undefined
  const warningFor = (saved: SavedCommand) => tileNote(saved, structure(saved))

  return (
    <DashboardPanel
      title="Saved commands"
      count={commands.length}
      collapsed={collapsed}
      onToggle={onToggle}
      className={collapsed ? 'shrink-0' : 'min-h-80 flex-1 lg:min-h-0'}
      controls={
        <>
          <Pager page={shown.page} pages={shown.pages} onPage={setPage} />
          <button
            type="button"
            aria-pressed={browsing}
            onClick={() => setBrowsing((was) => !was)}
            className="border-hairline border-border-hover text-text-secondary hover:text-text-primary aria-pressed:border-accent aria-pressed:text-accent flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold"
          >
            <Icon name="search" size="sm" />
            Browse
          </button>
        </>
      }
    >
      <div ref={measure} className="relative min-h-0 flex-1 overflow-hidden">
        {commands.length === 0 ? (
          <p className="text-text-secondary p-3.5 text-xs">
            Nothing saved yet. Build a command and keep it here.
          </p>
        ) : (
          <ul
            // eslint-disable-next-line no-restricted-syntax -- columns and rows are measured at runtime, which no static class can carry
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
            className="grid h-full gap-2.5 p-3"
          >
            {shown.items.map((saved) => (
              <SavedCommandTile
                key={saved.id}
                saved={saved}
                note={warningFor(saved)}
                linkable={linkable}
                onEdit={(element) => actions.onEdit(saved, element)}
                onRemove={() => actions.onRemove(saved.id)}
                onPin={() => actions.onPin(saved)}
                onLink={() => actions.onLink(saved)}
                drag={{
                  dragging: dragging === saved.id,
                  target: over === saved.id && dragging !== saved.id,
                  onDragStart: () => setDragging(saved.id),
                  onDragOver: () => setOver(saved.id),
                  onDrop: () => {
                    if (dragging && dragging !== saved.id) {
                      actions.onReorder(ids, dragging, saved.id)
                    }
                    setDragging(null)
                    setOver(null)
                  },
                  onDragEnd: () => {
                    setDragging(null)
                    setOver(null)
                  },
                }}
              />
            ))}
          </ul>
        )}
        <SavedBrowser
          open={browsing}
          commands={commands}
          groups={groups}
          warningFor={warningFor}
          onClose={() => setBrowsing(false)}
          onGroup={actions.onGroup}
          onTags={actions.onTags}
          onAddGroup={actions.onAddGroup}
          onEdit={actions.onEdit}
        />
      </div>
    </DashboardPanel>
  )
}
