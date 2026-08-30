import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { originOf, useUiStore } from '../stores/useUiStore'
import { SavedCommandTile } from './SavedCommandTile'
import { LABEL, WARNING } from './editors/fieldStyles'

const CTA =
  'border-hairline border-accent bg-accent text-canvas rounded-md px-3 py-1.5 font-mono text-1xs font-semibold'

/**
 * The saved commands, as tiles.
 *
 * This replaced `Landing`, a placeholder whose own comment asked to be replaced by
 * whatever read the catalogue instead of its hand-authored list of eight
 * "Coming soon" tiles. What is here now shows real state: a command someone kept, its
 * cached text, and the two things you can do to it without opening it.
 *
 * It reads `preview` rather than re-serializing. That is the whole reason the field
 * exists — drawing a dozen tiles from their value trees would mean pulling 560 KB of
 * command skeletons and 668 KB of registries on the app's first screen, which is
 * exactly the eager load the route split exists to prevent.
 */
export function Dashboard() {
  const commands = useSavedCommandsStore((s) => s.commands)
  const status = useSavedCommandsStore((s) => s.status)
  const error = useSavedCommandsStore((s) => s.error)
  const load = useSavedCommandsStore((s) => s.load)
  const rename = useSavedCommandsStore((s) => s.rename)
  const remove = useSavedCommandsStore((s) => s.remove)
  const openFrom = useUiStore((s) => s.openFrom)
  const navigate = useNavigate()

  useEffect(() => {
    void load()
  }, [load])

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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="font-title text-text-primary text-sm">Saved commands</h1>
        <span className={LABEL}>{commands.length}</span>
        <span className="flex-1" />
        <Link to="/c" className={CTA}>
          New command
        </Link>
      </div>

      {error && <p className={WARNING}>{error}</p>}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {commands.map((saved) => (
          <SavedCommandTile
            key={saved.id}
            saved={saved}
            onOpen={(element) => {
              // Captured at the moment of the click, because a rect is a fact about
              // this paint — anything that scrolls afterwards invalidates it. Keyed to
              // the command being opened, so the editor can look it up without anything
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
          />
        ))}
      </ul>
    </section>
  )
}
