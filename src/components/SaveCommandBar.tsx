import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CommandDefinition } from '../schema/types'
import type { VersionDefinition } from '../data/versions/types'
import type { CommandValue } from '../schema/serialize'
import { fingerprintOf } from '../schema/fingerprint'
import { storageKind, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { FIELD, LABEL, WARNING } from './editors/fieldStyles'
import { ROW_ADD } from './editors/rowStyles'

const BUTTON =
  'border-hairline border-border-subtle bg-surface text-text-primary hover:border-border-hover ' +
  'rounded-md px-2 py-1 font-mono text-1xs disabled:cursor-not-allowed ' +
  'disabled:text-text-faint disabled:hover:border-border-subtle'

/** The secondary row's controls, which are narrower than the primary one. */
const MINOR = `${BUTTON} flex-1`

/**
 * Keep this command, or act on the one being edited.
 *
 * The counterpart of the dashboard: without it there is nothing to put on a tile, and
 * `useSavedCommandsStore` has no caller. It writes the whole draft — including the
 * serialized text as `preview`, which is a cache the tile reads so a list view need
 * not pull the skeletons and registries that re-serializing would (see
 * `SavedCommand.preview`).
 *
 * **Two rows, beside the command rather than above it.** The workbench gives this a
 * column on the right of the output panel and the command keeps the width, because the
 * command is the product. Row one is the act that changes what is stored — save it,
 * save the changes, or rename it. Row two is everything that acts on a command already
 * stored. Splitting them that way rather than by frequency means the row that needs a
 * text field is the only row that has one, and the other three controls stay the same
 * size as each other.
 *
 * The three secondary controls are the same three a dashboard tile carries, and that
 * is the point rather than a coincidence: a saved command is one thing, and the two
 * places you meet it should offer the same verbs. What differs is only that here they
 * can be reached without going back to the dashboard first.
 *
 * Every state of this component shows all four controls, disabled where they cannot
 * act, with the reason in the accessible name — `distribution.md` § The split must be
 * visible, applied one level in. A command that has not been saved yet cannot be
 * linked, pinned or renamed, and saying so is better than three controls that appear
 * the moment something else succeeds.
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
  const rename = useSavedCommandsStore((s) => s.rename)
  const pin = useSavedCommandsStore((s) => s.pin)

  const saved = savedId === undefined ? undefined : commands.find((c) => c.id === savedId)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  // Fixed for the life of the build, the same way the dashboard reads it once for every
  // tile. Only the standalone build writes the file Konnekt reads, so only it can link.
  const linkable = storageKind() === 'file'

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

  // Nothing to save is not an error state and gets no message: a command that has not
  // been started yet is the ordinary condition of a page someone just opened.
  const empty = output === ''
  const pinned = saved?.pinned === true

  return (
    <div className="flex w-56 flex-col gap-1">
      {/*
        Row one, and the only row that ever holds a field. Which act it performs is the
        one thing about this component that changes shape, so it is the one thing
        branched on — the draft assembly below it is shared, which is the half that
        must not drift between "save" and "save again".
      */}
      {saved && !renaming ? (
        <div className="flex items-center gap-1">
          <span className={`${LABEL} min-w-0 flex-1 truncate`}>
            {`${saved.name} · rev ${saved.revision}`}
          </span>
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
        </div>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = name.trim()
            if (trimmed === '') return
            if (saved) {
              void rename(saved.id, trimmed).then(() => {
                setRenaming(false)
                setNote('renamed')
              })
              return
            }
            if (empty) return
            void create({
              name: trimmed,
              definitionId: definition.id,
              version: version.id,
              value,
              preview: output,
              fingerprint,
            }).then((id) => {
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
          {/*
            `aria-label` rather than a `<label htmlFor>` and an `id`. The visible label
            was dropped when this became a two-row block — the button beside it says
            which act the field is for, and a word above it would cost the row a line —
            so the choice is between a visually hidden label and naming the input
            directly. Direct is better here for a reason beyond brevity: an `id` has to
            be unique in the whole document, and this component is rendered inside an
            editor that can legitimately be mounted more than once (a test harness does
            it; a split view would). A duplicated `id` silently points every label at
            the first field.
          */}
          <input
            aria-label={saved ? 'Rename' : 'Save as'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={saved ? saved.name : 'name'}
            className={`${FIELD} min-w-0 flex-1`}
          />
          <button
            type="submit"
            className={BUTTON}
            disabled={name.trim() === '' || (!saved && empty)}
          >
            {saved ? 'Rename' : 'Save'}
          </button>
        </form>
      )}

      {/*
        Row two: the three verbs a dashboard tile carries, on the command already
        stored. `flex-1` on each so they divide the row evenly rather than sizing to
        their own words, which is what keeps the block reading as two lines instead of
        as a paragraph of buttons.
      */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={MINOR}
          disabled={!linkable || !saved}
          aria-label={
            !linkable
              ? 'link — needs the desktop build'
              : saved
                ? 'link'
                : 'link — save the command first'
          }
        >
          link
        </button>
        <button
          type="button"
          className={MINOR}
          disabled={!saved}
          aria-pressed={pinned}
          aria-label={saved ? undefined : 'pin — save the command first'}
          onClick={() => saved && void pin(saved.id, !pinned)}
        >
          {pinned ? 'pinned' : 'pin'}
        </button>
        <button
          type="button"
          className={MINOR}
          disabled={!saved}
          aria-label={saved ? undefined : 'rename — save the command first'}
          onClick={() => {
            if (!saved) return
            // Seeded with the current name rather than blank: a rename is usually an
            // edit of what is there, and an empty field makes the user retype it to
            // change one word.
            setName(renaming ? '' : saved.name)
            setRenaming((was) => !was)
          }}
        >
          rename
        </button>
      </div>

      {note && <span className={ROW_ADD}>{note}</span>}
      {error && <span className={WARNING}>{error}</span>}
    </div>
  )
}
