import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CommandDefinition } from '../schema/types'
import type { VersionDefinition } from '../data/versions/types'
import type { CommandValue } from '../schema/serialize'
import { fingerprintOf } from '../schema/fingerprint'
import { useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { FIELD, LABEL, WARNING } from './editors/fieldStyles'
import { ROW_ADD } from './editors/rowStyles'

const BUTTON =
  'border-hairline border-border-subtle bg-surface text-text-primary hover:border-border-hover ' +
  'rounded-md px-2 py-1 font-mono text-1xs'

/**
 * Keep this command, or update the one being edited.
 *
 * The counterpart of the dashboard: without it there is nothing to put on a tile, and
 * `useSavedCommandsStore` has no caller. It writes the whole draft — including the
 * serialized text as `preview`, which is a cache the tile reads so a list view need
 * not pull the skeletons and registries that re-serializing would (see
 * `SavedCommand.preview`).
 *
 * Two states, one component, because they are the same act at different points: a
 * command that has never been saved needs a name, and one that has needs a way to say
 * "this version too". Splitting them would duplicate the draft assembly, which is the
 * part that must not drift.
 */
export function SaveCommandBar({
  definition,
  version,
  value,
  output,
  savedId,
}: {
  definition: CommandDefinition
  version: VersionDefinition
  value: CommandValue
  /** The serialized command. Stored alongside the tree as the tile's display cache. */
  output: string
  /** The saved command being edited, if this session opened one. */
  savedId?: string
}) {
  const navigate = useNavigate()
  const commands = useSavedCommandsStore((s) => s.commands)
  const status = useSavedCommandsStore((s) => s.status)
  const error = useSavedCommandsStore((s) => s.error)
  const load = useSavedCommandsStore((s) => s.load)
  const create = useSavedCommandsStore((s) => s.create)
  const revise = useSavedCommandsStore((s) => s.revise)

  const saved = savedId === undefined ? undefined : commands.find((c) => c.id === savedId)
  const [name, setName] = useState('')
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  // The note is about one particular save, so any further edit makes it stale. Keyed
  // on the output rather than cleared on a timer: "saved" should stay on screen for as
  // long as it is still true, which is until the command changes.
  useEffect(() => setNote(null), [output])

  if (status === 'unavailable') {
    return (
      <p className={LABEL}>
        Saving is off — this browser is not letting the page store anything. Everything else still
        works.
      </p>
    )
  }

  // Stamped here because this is the layer that holds the definition. The tree being
  // saved is the one the workbench just rendered from it, so the shape recorded is the
  // shape it was actually built against — which is the whole claim the fingerprint
  // makes. `saved.ts` stays a record builder and never learns to walk a definition.
  const fingerprint = fingerprintOf(definition)

  const draft = {
    name: name.trim(),
    definitionId: definition.id,
    version: version.id,
    value,
    preview: output,
    fingerprint,
  }

  // Nothing to save is not an error state and gets no message: a command that has not
  // been started yet is the ordinary condition of a page someone just opened.
  const empty = output === ''

  if (saved) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>{`Saved as ${saved.name} · revision ${saved.revision}`}</span>
        <button
          type="button"
          className={BUTTON}
          disabled={empty}
          onClick={() => {
            void revise(saved.id, { value, preview: output, fingerprint }).then(() =>
              setNote('updated'),
            )
          }}
        >
          Save changes
        </button>
        {note && <span className={ROW_ADD}>{note}</span>}
        {error && <span className={WARNING}>{error}</span>}
      </div>
    )
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (empty || draft.name === '') return
        void create(draft).then((id) => {
          if (id === null) return
          setNote('saved')
          // Into the URL, so a reload resumes the saved command rather than a blank
          // one, and so every later edit updates this record instead of minting a
          // second copy of the same command under a new id.
          void navigate({
            to: '/c/$commandId',
            params: { commandId: definition.id },
            search: { saved: id },
            replace: true,
          })
        })
      }}
    >
      <label className={LABEL} htmlFor="save-name">
        Save as
      </label>
      <input
        id="save-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="name"
        className={FIELD}
      />
      <button type="submit" className={BUTTON} disabled={empty || name.trim() === ''}>
        Save
      </button>
      {note && <span className={ROW_ADD}>{note}</span>}
      {error && <span className={WARNING}>{error}</span>}
    </form>
  )
}
