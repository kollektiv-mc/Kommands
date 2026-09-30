import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CommandDefinition } from '../schema/types'
import type { VersionDefinition } from '../data/versions/types'
import type { CommandValue } from '../schema/serialize'
import { fingerprintOf } from '../schema/fingerprint'
import { contentChange } from '../schema/saved'
import { storageKind, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { FIELD, FOCUS, WARNING } from './editors/fieldStyles'
import { MenuButton } from './ui/MenuButton'
import { Popover } from './ui/Popover'

/** The save controls' button: quieter than Copy, which is the primary action beside it. */
const BUTTON =
  `${FOCUS} border-hairline border-border-hover text-text-primary hover:bg-hover ` +
  'inline-flex h-8 items-center rounded-md px-3 text-xs font-medium whitespace-nowrap ' +
  'transition-colors duration-fast motion-reduce:transition-none ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

const SUBMIT =
  `${FOCUS} bg-accent text-canvas hover:bg-accent/85 h-8 rounded-md px-3 text-xs font-semibold ` +
  'transition-colors duration-fast motion-reduce:transition-none ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Keep this command, or act on the one being edited.
 *
 * The counterpart of the dashboard: without it there is nothing to put on a tile, and
 * `useSavedCommandsStore` has no caller. It writes the whole draft, including the
 * serialized text as `preview`, which is a cache the tile reads so a list view need
 * not pull the skeletons and registries that re-serializing would (see
 * `SavedCommand.preview`).
 *
 * **Two controls in the output panel's row, beside Copy.** Copy is what nearly every
 * session ends with, so it is the primary button and these are quieter. The first
 * control changes what is stored: Save opens a small popover for the name, and a
 * command already saved shows Save changes instead. Everything that acts on a command
 * already stored (rename, pin, link) sits behind the "more" button, as the same verbs
 * a dashboard tile carries: a saved command is one thing, and the two places you meet
 * it should offer the same verbs.
 *
 * Every verb is present in every state, disabled where it cannot act, with the reason
 * beside it: `distribution.md` § The split must be visible, applied one level in. A
 * command that has not been saved yet cannot be linked, pinned or renamed, and saying
 * so is better than three verbs that appear the moment something else succeeds.
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
  const link = useSavedCommandsStore((s) => s.link)

  const saved = savedId === undefined ? undefined : commands.find((c) => c.id === savedId)
  const anchor = useRef<HTMLDivElement>(null)
  const [naming, setNaming] = useState<'save' | 'rename' | null>(null)
  const closeNaming = useCallback(() => setNaming(null), [setNaming])

  // What the last save did, and to which output. Shown only while the command is still
  // that output, so "saved" stays on screen for as long as it is true and an edit
  // clears it, with no effect setting state after every keystroke.
  const [note, setNote] = useState<{ output: string; text: string } | null>(null)
  const shownNote = note?.output === output ? note.text : ''

  // Fixed for the life of the build, the same way the dashboard reads it once for every
  // tile. Only the standalone build writes the file Konnekt reads, so only it can link.
  const linkable = storageKind() === 'file'

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  if (status === 'unavailable') {
    const reason = 'Saving is off: this browser is not letting the page store anything'
    return (
      <button type="button" className={BUTTON} disabled aria-label={reason} title={reason}>
        Save…
      </button>
    )
  }

  // Stamped here because this is the layer that holds the definition. The tree being
  // saved is the one the workbench just rendered from it, so the shape recorded is the
  // shape it was actually built against, which is the whole claim the fingerprint
  // makes. `saved.ts` stays a record builder and never learns to walk a definition.
  const fingerprint = fingerprintOf(definition)

  // Nothing to save is not an error state and gets no message: a command that has not
  // been started yet is the ordinary condition of a page someone just opened.
  const empty = output === ''
  const pinned = saved?.pinned === true
  const linked = saved?.linked === true

  // Whether pressing Save changes would do anything, asked of the same function that
  // decides it (`contentChange`) rather than of a second guess that could disagree
  // with the store. It is what greys the control out on a command nobody has touched
  // since it was opened, which is the honest form of "this save is a no-op".
  const change = saved ? contentChange(saved, { value, preview: output, fingerprint }) : 'emitted'

  const submitName = (name: string) => {
    if (saved) {
      void rename(saved.id, name).then(() => {
        setNaming(null)
        setNote({ output, text: 'Renamed' })
      })
      return
    }
    if (empty) return
    void create({
      name,
      definitionId: definition.id,
      version: version.id,
      value,
      preview: output,
      fingerprint,
    }).then((id) => {
      if (id === null) return
      setNaming(null)
      setNote({ output, text: 'Saved' })
      // Into the URL, so a reload resumes the saved command rather than a blank one,
      // and so every later edit updates this record instead of minting a second copy
      // of the same command under a new id.
      void navigate({
        to: '/c/$commandId',
        params: { commandId: definition.id },
        search: { saved: id },
        replace: true,
      })
    })
  }

  const firstSave = saved ? undefined : 'Save first'

  return (
    <div className="flex items-center gap-1">
      {/* Said politely rather than as a status role: the output panel's status line is
          the one status on the page, and this is only a receipt. */}
      <span aria-live="polite" className="text-accent text-1xs px-1 whitespace-nowrap">
        {shownNote}
      </span>
      {error && (
        <span className={`${WARNING} max-w-40 truncate`} title={error}>
          {error}
        </span>
      )}
      <div ref={anchor} className="relative inline-flex">
        {saved ? (
          <button
            type="button"
            className={BUTTON}
            title={`${saved.name}, revision ${saved.revision}`}
            disabled={empty || change === 'none'}
            aria-label={
              change === 'none'
                ? 'Save changes: nothing has changed since the last save'
                : undefined
            }
            onClick={() => {
              void revise(saved.id, { value, preview: output, fingerprint }).then(() =>
                // Not always "updated": a tree edit that emits the same text is worth
                // storing and is deliberately not worth a revision, and saying
                // otherwise beside a number that did not move reads as a bug.
                setNote({
                  output,
                  text: change === 'emitted' ? 'Updated' : 'Saved, output unchanged',
                }),
              )
            }}
          >
            Save changes
          </button>
        ) : (
          <button
            type="button"
            className={BUTTON}
            aria-expanded={naming === 'save'}
            disabled={empty}
            onClick={() => setNaming((was) => (was === 'save' ? null : 'save'))}
          >
            Save…
          </button>
        )}
        {naming && (
          <Popover container={anchor} onDismiss={closeNaming} align="end" className="p-2">
            <NameForm
              label={naming === 'rename' ? 'Rename' : 'Save as'}
              submit={naming === 'rename' ? 'Rename' : 'Save'}
              initial={naming === 'rename' ? (saved?.name ?? '') : ''}
              onSubmit={submitName}
              onCancel={closeNaming}
            />
          </Popover>
        )}
      </div>
      <MenuButton
        label="More"
        icon="more"
        iconOnly
        align="end"
        items={[
          {
            key: 'rename',
            label: 'Rename',
            description: firstSave,
            disabled: !saved,
            onSelect: () => setNaming('rename'),
          },
          {
            key: 'pin',
            label: pinned ? 'Unpin from Quick' : 'Pin to Quick',
            description: firstSave,
            disabled: !saved,
            onSelect: () => saved && void pin(saved.id, !pinned),
          },
          {
            key: 'link',
            label: linked ? 'Unlink from Konnekt' : 'Link to Konnekt',
            // The build reason first, because that one is permanent and the other is
            // not: a web session will never link however much it saves.
            description: !linkable ? 'Desktop app only' : firstSave,
            disabled: !linkable || !saved,
            onSelect: () => saved && void link(saved.id, !linked),
          },
        ]}
      />
    </div>
  )
}

/**
 * The name field in the save popover. Its own component so it mounts with the popover:
 * the draft starts from `initial` on every opening, and focus lands in the field.
 */
function NameForm({
  label,
  submit,
  initial,
  onSubmit,
  onCancel,
}: {
  label: string
  submit: string
  initial: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  // Seeded with the current name on a rename: a rename is usually an edit of what is
  // there, and an empty field makes someone retype it to change one word.
  const [name, setName] = useState(initial)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    // The editor overlay closes on Escape too. This one only meant "not now".
    event.preventDefault()
    event.stopPropagation()
    onCancel()
  }

  return (
    <form
      className="flex w-64 items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (trimmed !== '') onSubmit(trimmed)
      }}
    >
      {/*
        `aria-label` rather than a `<label htmlFor>` and an `id`: the button beside it
        says which act the field is for, and an `id` has to be unique in the whole
        document while this component can be mounted more than once (a test harness
        does it; a split view would).
      */}
      <input
        ref={field}
        aria-label={label}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="name"
        className={`${FIELD} min-w-0 flex-1`}
      />
      <button type="submit" className={SUBMIT} disabled={name.trim() === ''} onKeyDown={onKeyDown}>
        {submit}
      </button>
    </form>
  )
}
