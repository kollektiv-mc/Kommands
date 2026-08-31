import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { storageKind, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { originOf, useUiStore } from '../stores/useUiStore'
import { SavedCommandTile } from './SavedCommandTile'
import { AddPanelMenu } from './dashboard/AddPanelMenu'
import { DashboardPanel } from './dashboard/DashboardPanel'
import { panelById } from './dashboard/panels'
import { LABEL, WARNING } from './editors/fieldStyles'

const CTA =
  'border-hairline border-accent bg-accent text-canvas rounded-md px-3 py-1.5 font-mono text-1xs font-semibold'

/**
 * The saved commands, as a stack of panels.
 *
 * Each panel is a view over the one saved-commands list — Saved is all of them, Recent
 * is the ones opened lately, Quick is the pinned ones — so a command can show in more
 * than one at a time and nothing is duplicated behind the scenes. See
 * `dashboard/panels.ts` for why they are lenses rather than folders.
 *
 * Panels stack vertically and the page scrolls, rather than sitting on a draggable
 * grid. Konnekt uses `react-grid-layout` for its canvas; this app has roughly 11 KB of
 * entry-chunk budget left against a CI-enforced ceiling, and that library plus its CSS
 * would spend most of it on a rearrangement nobody asked for.
 *
 * Every tile still reads its `preview` string rather than re-serializing. That is the
 * whole reason the field exists: drawing them from their value trees would pull 560 KB
 * of command skeletons and 668 KB of registries onto the app's first screen.
 */
export function Dashboard() {
  const commands = useSavedCommandsStore((s) => s.commands)
  const status = useSavedCommandsStore((s) => s.status)
  const error = useSavedCommandsStore((s) => s.error)
  const load = useSavedCommandsStore((s) => s.load)
  const rename = useSavedCommandsStore((s) => s.rename)
  const remove = useSavedCommandsStore((s) => s.remove)
  const pin = useSavedCommandsStore((s) => s.pin)

  const placed = useDashboardStore((s) => s.placed)
  const removed = useDashboardStore((s) => s.removed)
  const hydrate = useDashboardStore((s) => s.hydrate)
  const removePanel = useDashboardStore((s) => s.remove)
  const restorePanel = useDashboardStore((s) => s.restore)

  // Fixed for the life of the build, so it is read once here rather than per tile.
  // Only the standalone build writes the file Konnekt reads, so only it can link.
  const linkable = storageKind() === 'file'

  const openFrom = useUiStore((s) => s.openFrom)
  const navigate = useNavigate()

  useEffect(() => {
    void load()
    hydrate()
  }, [load, hydrate])

  // Selected once per render rather than per panel, and memoised on the command list —
  // these are plain array functions, and calling them inside a Zustand selector would
  // return a fresh array on every store touch and re-render the whole dashboard.
  const views = useMemo(
    () =>
      placed
        .map((id) => panelById(id))
        .filter((panel) => panel !== undefined)
        .map((panel) => ({ panel, commands: panel.select(commands) })),
    [placed, commands],
  )

  if (status === 'unavailable') {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-display text-text-primary text-4xl tracking-tight">Kommands</h1>
        {/*
          Not an error screen. A browser refusing site data has a working generator and
          no way to keep what it makes, which is a smaller problem than it looks — so
          this says what is off and then gets out of the way.
        */}
        <p className={LABEL}>
          This browser is not letting the page store anything, so commands cannot be saved here. The
          generator itself works.
        </p>
        <Link to="/c" className={CTA}>
          Open the generator
        </Link>
      </section>
    )
  }

  if (status === 'idle' || status === 'loading') {
    return <p className={LABEL}>Loading saved commands…</p>
  }

  if (commands.length === 0) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-text-primary text-5xl tracking-tight sm:text-6xl">
          Kommands
        </h1>
        <p className={LABEL}>Nothing saved yet. Build a command and keep it here.</p>
        <Link to="/c" className={CTA}>
          New command
        </Link>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="font-title text-text-primary text-sm">Dashboard</h1>
        <span className={LABEL}>{`${commands.length} saved`}</span>
        <span className="flex-1" />
        <AddPanelMenu removed={removed} onRestore={restorePanel} />
        <Link to="/c" className={CTA}>
          New command
        </Link>
      </div>

      {/*
        Said once, up here, rather than repeated under every tile. The `link` control on
        each tile carries the same reason in its accessible name; this is the sentence a
        sighted user reads to find out why the control is dim, which is what "stated,
        not discovered" means in `distribution.md` § The split must be visible.
      */}
      {!linkable && (
        <p className={LABEL}>
          Sending a command to Konnekt needs the standalone build — a browser cannot reach the file
          the two share.
        </p>
      )}

      {error && <p className={WARNING}>{error}</p>}

      {views.map(({ panel, commands: shown }) => (
        <DashboardPanel
          key={panel.id}
          panel={panel}
          count={shown.length}
          onRemove={() => removePanel(panel.id)}
        >
          {shown.length === 0 ? (
            <p className={LABEL}>{panel.empty}</p>
          ) : (
            /*
              Narrower columns than the old four-across grid. A command tile holds a
              name and one line of monospace command text; at a quarter of a wide
              viewport that line had far more room than it needed and the tiles read as
              cards rather than as entries.
            */
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {shown.map((saved) => (
                <SavedCommandTile
                  key={saved.id}
                  saved={saved}
                  onOpen={(element) => {
                    // Captured at the click, because a rect is a fact about this paint.
                    // Keyed to the command so the editor can look it up without anything
                    // having to consume it — see useUiStore.originFor.
                    openFrom(saved.id, originOf(element))
                    void navigate({
                      to: '/c/$commandId',
                      params: { commandId: saved.definitionId },
                      search: { saved: saved.id },
                    })
                  }}
                  onRename={(name) => void rename(saved.id, name)}
                  onRemove={() => void remove(saved.id)}
                  onPin={() => void pin(saved.id, saved.pinned !== true)}
                  linkable={linkable}
                />
              ))}
            </ul>
          )}
        </DashboardPanel>
      ))}
    </div>
  )
}
