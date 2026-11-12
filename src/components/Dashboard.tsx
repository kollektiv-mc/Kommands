import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { storageKind, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { usePinnedGeneratorsStore } from '../stores/usePinnedGeneratorsStore'
import { originOf, useUiStore } from '../stores/useUiStore'
import { PinnedPanel } from './dashboard/PinnedPanel'
import { SavedPanel } from './dashboard/SavedPanel'
import { ListPanel } from './dashboard/ListPanel'
import { PANELS, arrange, panelById, type CommandPanel, type PanelId } from './dashboard/panels'
import { loadFingerprints } from '../data/loadGenerated'
import { v1_21_1 } from '../data/versions/1.21.1'
import { LABEL, WARNING } from './editors/fieldStyles'

const CTA =
  'border-hairline border-accent bg-accent text-canvas hover:bg-accent/85 rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold'

/**
 * The dashboard: pinned generators across the top, saved commands beside Recent, Quick
 * and Linked to Konnekt.
 *
 * Each panel is a view rather than a folder: Saved is all of them, Recent the ones
 * opened lately, Quick the pinned ones, so a command can show in more than one at once.
 * Pinned generators read a different collection; see `dashboard/panels.ts`.
 *
 * On a wide window the dashboard fills it and never scrolls: every panel shows what
 * fits and pages the rest, and the saved commands browser is the one thing that
 * scrolls. Narrower than `lg` the panels stack and the page scrolls instead.
 *
 * Tiles read each command's cached `preview`, and pinned generators a label snapshotted
 * at pin time, so the dashboard never loads the command skeletons or registries.
 */
export function Dashboard() {
  const commands = useSavedCommandsStore((s) => s.commands)
  const status = useSavedCommandsStore((s) => s.status)
  const error = useSavedCommandsStore((s) => s.error)
  const load = useSavedCommandsStore((s) => s.load)
  const remove = useSavedCommandsStore((s) => s.remove)
  const pin = useSavedCommandsStore((s) => s.pin)
  const link = useSavedCommandsStore((s) => s.link)
  const group = useSavedCommandsStore((s) => s.group)
  const tag = useSavedCommandsStore((s) => s.tag)

  const hydrate = useDashboardStore((s) => s.hydrate)
  const collapsed = useDashboardStore((s) => s.collapsed)
  const toggleCollapsed = useDashboardStore((s) => s.toggleCollapsed)
  const order = useDashboardStore((s) => s.order)
  const reorder = useDashboardStore((s) => s.reorder)
  const groups = useDashboardStore((s) => s.groups)
  const addGroup = useDashboardStore((s) => s.addGroup)

  const pinnedGenerators = usePinnedGeneratorsStore((s) => s.pinned)
  const hydratePins = usePinnedGeneratorsStore((s) => s.hydrate)
  const togglePin = usePinnedGeneratorsStore((s) => s.toggle)

  // Only the standalone build writes the file Konnekt reads, so only it can link.
  const linkable = storageKind() === 'file'

  const openFrom = useUiStore((s) => s.openFrom)
  const navigate = useNavigate()

  // The fingerprint index (~1.6 KB gzipped), so a tile can warn that a command will
  // not reopen as saved before it is opened. Null until it arrives; a failure leaves it
  // null, and the editor still refuses on open.
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
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const saved = useMemo(() => arrange(commands, order), [commands, order])
  const lenses = useMemo(
    () =>
      PANELS.filter(
        (panel): panel is CommandPanel => panel.source === 'commands' && panel.id !== 'saved',
      ).map((panel) => ({ panel, commands: panel.select(commands) })),
    [commands],
  )

  if (status === 'unavailable') {
    return (
      <section className="flex flex-col items-start gap-3">
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

  const pinnedPanel = panelById('pinned')
  const isCollapsed = (id: PanelId) => collapsed.includes(id)
  const linkedCount = commands.filter((c) => c.linked === true).length

  return (
    <div className="flex flex-col gap-4.5 lg:h-full">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="font-title text-text-primary text-xl font-bold tracking-tight">Dashboard</h1>
        {/* The linked count only where linking is possible; on the web it would read 0 forever. */}
        <span className="text-text-secondary font-mono text-xs">
          {linkable
            ? `${commands.length} saved · ${linkedCount} linked`
            : `${commands.length} saved`}
        </span>
        <span className="flex-1" />
        <Link to="/c" className={CTA}>
          New command
        </Link>
      </div>

      {error && <p className={WARNING}>{error}</p>}

      <PinnedPanel
        generators={pinnedGenerators}
        empty={pinnedPanel?.empty ?? ''}
        collapsed={isCollapsed('pinned')}
        onToggle={() => toggleCollapsed('pinned')}
        onUnpin={togglePin}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_--spacing(85)] lg:grid-rows-[minmax(0,1fr)]">
        <SavedPanel
          commands={saved}
          groups={groups}
          fingerprints={fingerprints}
          linkable={linkable}
          collapsed={isCollapsed('saved')}
          onToggle={() => toggleCollapsed('saved')}
          actions={{
            onEdit: (command, element) => {
              // Captured at the click, because a rect is a fact about this paint.
              openFrom(command.id, originOf(element))
              void navigate({
                to: '/c/$commandId',
                params: { commandId: command.definitionId },
                search: { saved: command.id },
              })
            },
            onRemove: (id) => void remove(id),
            onPin: (command) => void pin(command.id, command.pinned !== true),
            onLink: (command) => void link(command.id, command.linked !== true),
            onReorder: reorder,
            onGroup: (id, name) => void group(id, name),
            onTags: (id, tags) => void tag(id, tags),
            onAddGroup: addGroup,
          }}
        />
        <div className="flex min-h-0 min-w-0 flex-col gap-5">
          {lenses.map(({ panel, commands: shown }) => (
            <ListPanel
              key={panel.id}
              title={panel.title}
              empty={panel.empty}
              commands={shown}
              collapsed={isCollapsed(panel.id)}
              onToggle={() => toggleCollapsed(panel.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
