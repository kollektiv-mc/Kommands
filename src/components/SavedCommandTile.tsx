import { useState } from 'react'
import type { SavedCommand, StructureState } from '../schema/saved'
import { resumability } from '../schema/saved'
import { findVersion } from '../data/versions'
import { v1_21_1 } from '../data/versions/1.21.1'
import { FIELD, LABEL, WARNING } from './editors/fieldStyles'
import { ROW_ADD, ROW_REMOVE } from './editors/rowStyles'

/** A control that is present on purpose and cannot be used yet. */
const DISABLED = 'text-text-faint text-2xs cursor-not-allowed'

/** What the three resumability answers say to someone looking at a tile. */
const RESUMABILITY_NOTE = {
  ready: null,
  retraited: 'Authored for a version that writes this differently',
  'unknown-version': 'Authored for a version this build does not know',
} as const

/**
 * What the structural verdict says here — shorter than the editor's wording in
 * `CommandEditor.REFUSAL`, and deliberately so: this is a badge on a tile, and the
 * full explanation belongs at the moment of the refusal rather than in a grid of
 * twelve of them. The outcome is identical either way; the tile only says it sooner.
 */
const STRUCTURE_NOTE = {
  verified: null,
  stale: 'Saved against an older shape of this command — opens empty',
  'unknown-command': 'The command this was built for is not in this build',
  unverified: 'Saved before Kommands recorded command shapes — opens empty',
} as const

/**
 * One saved command, as a panel.
 *
 * A panel in the shared language's sense: `rounded-panel` + `border-hairline` over
 * `bg-surface`, with no shadow — elevation here is the translucent surface and the
 * hairline, and the token set has no shadow to reach for.
 *
 * The whole tile is the control that opens it, which is what makes the expand
 * animation read as the tile becoming the editor rather than as a button being
 * pressed. Rename and delete sit inside it and stop propagation, so the two never
 * fight: clicking a tile opens, clicking a control in a tile does that control.
 */
export function SavedCommandTile({
  saved,
  onOpen,
  onRename,
  onRemove,
  onPin,
  linkable,
  structure,
}: {
  saved: SavedCommand
  /** Given the tile's own element, so the caller can capture the rect it grows from. */
  onOpen: (element: HTMLElement) => void
  onRename: (name: string) => void
  onRemove: () => void
  /** Toggle the pin that puts this command in the Quick panel. */
  onPin: () => void
  /**
   * Whether this build can send a command to Konnekt at all.
   *
   * Passed in rather than read here, so the answer is fetched once for the dashboard
   * instead of once per tile — and so this component stays something that renders what
   * it is given.
   */
  linkable: boolean
  /**
   * Whether the definition still has the shape this tree was built against, judged
   * against the committed fingerprint index rather than the definition itself.
   *
   * `undefined` while that index is still loading. Passed in for the same reason
   * `linkable` is: the index is fetched once for the dashboard, not once per tile.
   */
  structure?: StructureState
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(saved.name)

  // One note, and *version* outranks structure — which is the opposite of what tile
  // real-estate would suggest and is the honest order. The index this build ships
  // describes the *active* version's definitions, so comparing a tree authored for
  // another version against it is a comparison across two catalogues: it can report
  // "the shape moved" when what actually moved is the version. Where the version is
  // foreign, that is the fact to state, and the structural verdict is not evidence.
  //
  // So the structural note speaks only once the version question is settled — and
  // `structure` is undefined while the index is still loading, the one case with
  // nothing honest to say yet.
  const version = resumability(saved, v1_21_1, findVersion)
  const note =
    version === 'ready'
      ? structure
        ? STRUCTURE_NOTE[structure]
        : null
      : RESUMABILITY_NOTE[version]

  return (
    <li
      className="border-hairline border-border-subtle bg-surface rounded-panel hover:border-border-hover flex flex-col gap-1.5 p-3"
      data-saved-id={saved.id}
    >
      {renaming ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const next = draft.trim()
            if (next !== '') onRename(next)
            setRenaming(false)
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Name"
            autoFocus
            className={FIELD}
          />
          <button type="submit" className={LABEL}>
            Rename
          </button>
        </form>
      ) : (
        <button
          type="button"
          // The tile's own element rather than the button's: the rect the editor grows
          // from should be the panel the user sees, and a button laid out inside it is
          // a different, smaller box.
          onClick={(e) => onOpen(e.currentTarget.closest('li')!)}
          className="text-text-primary text-left font-mono text-sm font-semibold"
        >
          {saved.name}
        </button>
      )}

      <code className="text-text-secondary text-2xs font-mono break-all">
        {saved.preview || <span className="text-text-faint">empty command</span>}
      </code>

      <div className="mt-auto flex items-center gap-2">
        <span className={LABEL}>{`${saved.definitionId} · rev ${saved.revision}`}</span>
        <span className="flex-1" />
        {/*
          Present and disabled rather than absent. Linking is standalone-only and
          permanently so, and `distribution.md` § The split must be visible names the
          failure to design against: a user discovering that by finding nothing where
          they expected something. A control that is there and says why is a smaller
          disappointment than one that never appears.

          The reason lives in the accessible name as well as in the header line above,
          because a `title` is discovered on hover — which is the same failure one level
          down. `SavedCommandStorage.kind` is what decides; nothing here sniffs a user
          agent or a build flag.
        */}
        <button
          type="button"
          className={linkable ? ROW_ADD : DISABLED}
          disabled={!linkable}
          aria-label={linkable ? 'link' : 'link — needs the desktop build'}
        >
          link
        </button>
        <button
          type="button"
          className={saved.pinned === true ? ROW_ADD : ROW_REMOVE}
          onClick={onPin}
          aria-pressed={saved.pinned === true}
        >
          {saved.pinned === true ? 'pinned' : 'pin'}
        </button>
        {!renaming && (
          <button type="button" className={ROW_REMOVE} onClick={() => setRenaming(true)}>
            rename
          </button>
        )}
        <button type="button" className={ROW_REMOVE} onClick={onRemove}>
          delete
        </button>
      </div>

      {note && <span className={WARNING}>{note}</span>}
    </li>
  )
}
