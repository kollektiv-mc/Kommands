import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { storageKind, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { usePinnedGeneratorsStore } from '../stores/usePinnedGeneratorsStore'
import { originOf, useUiStore } from '../stores/useUiStore'
import { SavedCommandTile } from './SavedCommandTile'
import { PinnedGeneratorTile } from './PinnedGeneratorTile'
import { AddPanelMenu } from './dashboard/AddPanelMenu'
import { DashboardPanel } from './dashboard/DashboardPanel'
import { panelById } from './dashboard/panels'
import { loadFingerprints } from '../data/loadGenerated'
import { structureStateFromIndex } from '../schema/saved'
import { v1_21_1 } from '../data/versions/1.21.1'
import { LABEL, WARNING } from './editors/fieldStyles'

const CTA =
  'border-hairline border-accent bg-accent text-canvas rounded-md px-3 py-1.5 font-mono text-1xs font-semibold'

/**
 * The dashboard: four organizers over one saved-commands list and one pin list.
 *
 * Each panel is a view rather than a folder — Saved is all of them, Recent is the ones
 * opened lately, Quick is the pinned ones — so a command can show in more than one at a
 * time and nothing is duplicated behind the scenes. Pinned generators are the exception
 * and read a different collection; see `dashboard/panels.ts` for why that is a union
 * rather than a fourth lens.
 *
 * **There is no empty-state hero.** There was one — a full-page wordmark, a sentence,
 * and a New command button, shown whenever nothing was saved — and it was wrong twice
 * over. It hid the organizers from exactly the person who had never seen them, so the
 * dashboard's shape was a thing you discovered by saving something first; and it put
 * the product name in the middle of the page while the title bar was already carrying
 * it. An empty organizer now says it is empty, in one sentence, and takes up no more
 * room than that sentence needs.
 *
 * Panels stack vertically and the page scrolls, rather than sitting on a draggable
 * grid. Konnekt uses `react-grid-layout` for its canvas; this app has roughly 5 KB of
 * entry-chunk budget left against a CI-enforced ceiling, and that library plus its CSS
 * would spend most of it on a rearrangement nobody asked for.
 *
 * Every tile still reads its `preview` string rather than re-serializing, and a pinned
 * generator reads a label snapshotted at pin time. That is the whole reason both fields
 * exist: drawing either from a definition would pull 560 KB of command skeletons and
 * 668 KB of registries onto the app's first screen.
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
  const collapsed = useDashboardStore((s) => s.collapsed)
  const toggleCollapsed = useDashboardStore((s) => s.toggleCollapsed)

  const pinnedGenerators = usePinnedGeneratorsStore((s) => s.pinned)
  const hydratePins = usePinnedGeneratorsStore((s) => s.hydrate)
  const togglePin = usePinnedGeneratorsStore((s) => s.toggle)

  // Fixed for the life of the build, so it is read once here rather than per tile.
  // Only the standalone build writes the file Konnekt reads, so only it can link.
  const linkable = storageKind() === 'file'

  const openFrom = useUiStore((s) => s.openFrom)
  const navigate = useNavigate()

  // The fingerprint index, so a tile can say a tree will not restore *before* it is
  // opened. Deliberately the only generated file this view loads: ~1.6 KB gzipped
  // against the 560 KB of command skeletons that answering the same question from a
  // definition would cost — which is the whole reason a saved command caches a
  // `preview`. Held as null until it arrives, and a failure leaves it null rather than
  // surfacing: an unreachable index costs a warning the editor still gives on open, so
  // it is not worth an error message about a file the user has never heard of.
  const [fingerprints, setFingerprints] = useState<Readonly<Record<string, string>> | null>(null)

  useEffect(() => {
    void load()
    hydrate()
    hydratePins()
  }, [load, hydrate, hydratePins])

  useEffect(() => {
    let live = true
    loadFingerprints(v1_21_1)
      .then((index) => {
        if (live) setFingerprints(index)
      })
      .catch(() => {
        // Left null: tiles simply say nothing structural, as they did before the index
        // existed. The refusal on open is unaffected — it hashes the real definition.
      })
    return () => {
      live = false
    }
  }, [])

  // Selected once per render rather than per panel, and memoised on the command list —
  // these are plain array functions, and calling them inside a Zustand selector would
  // return a fresh array on every store touch and re-render the whole dashboard.
  const views = useMemo(
    () =>
      placed
        .map((id) => panelById(id))
        .filter((panel) => panel !== undefined)
        .map((panel) => ({
          panel,
          commands: panel.source === 'commands' ? panel.select(commands) : [],
        })),
    [placed, commands],
  )

  if (status === 'unavailable') {
    return (
      <section className="flex flex-col items-start gap-3">
        {/*
          Not an error screen. A browser refusing site data has a working generator and
          no way to keep what it makes, which is a smaller problem than it looks — so
          this says what is off and then gets out of the way. No wordmark: the title bar
          carries it on every route, including this one.
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

      {views.map(({ panel, commands: shown }) =>
        panel.source === 'generators' ? (
          <DashboardPanel
            key={panel.id}
            panel={panel}
            count={pinnedGenerators.length}
            collapsed={collapsed.includes(panel.id)}
            onToggle={() => toggleCollapsed(panel.id)}
            onRemove={() => removePanel(panel.id)}
          >
            {pinnedGenerators.map((generator) => (
              <PinnedGeneratorTile
                key={generator.id}
                generator={generator}
                onUnpin={() => togglePin(generator)}
              />
            ))}
          </DashboardPanel>
        ) : (
          <DashboardPanel
            key={panel.id}
            panel={panel}
            count={shown.length}
            collapsed={collapsed.includes(panel.id)}
            onToggle={() => toggleCollapsed(panel.id)}
            onRemove={() => removePanel(panel.id)}
          >
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
                structure={fingerprints ? structureStateFromIndex(saved, fingerprints) : undefined}
              />
            ))}
          </DashboardPanel>
        ),
      )}
    </div>
  )
}
