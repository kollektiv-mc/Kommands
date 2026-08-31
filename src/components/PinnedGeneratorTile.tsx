import { Link } from '@tanstack/react-router'
import type { PinnedGenerator } from '../storage/preferences'
import { LABEL } from './editors/fieldStyles'
import { IconButton } from './ui/IconButton'
import { Icon } from './ui/Icon'

/**
 * One pinned command generator, as a panel.
 *
 * The same shape as `SavedCommandTile` — `rounded-panel` + `border-hairline` over
 * `bg-surface`, no shadow — because they sit in the same grid and a second tile
 * language would read as a rendering bug rather than as a distinction. What differs is
 * what they say: a saved command shows the text it produces, and this shows only a
 * name, because a generator has produced nothing yet.
 *
 * A `<Link>` rather than a button with a handler, so the browser's own affordances keep
 * meaning something: middle-click, open in a new tab, and the address bar all work.
 * `CommandNav` made the same call for the same reason.
 *
 * Note what is *not* here: no rect is captured and no `openFrom` is called. The
 * grow-out-of-the-tile animation belongs to opening a saved command — it is the tile
 * *becoming* the editor for that record. Starting a fresh command from a generator is
 * not that gesture, and borrowing the animation would claim a continuity that does not
 * exist. `CommandOverlay` falls back to a plain scale-up, which is the honest one.
 */
export function PinnedGeneratorTile({
  generator,
  onUnpin,
}: {
  generator: PinnedGenerator
  onUnpin: () => void
}) {
  return (
    <li className="border-hairline border-border-subtle bg-surface rounded-panel hover:border-border-hover flex min-h-24 flex-col gap-1.5 p-3">
      <Link
        to="/c/$commandId"
        params={{ commandId: generator.id }}
        className="text-text-primary text-left font-mono text-sm font-semibold"
      >
        {/*
          The label snapshotted at pin time, never resolved from the catalogue. The
          dashboard does not load the 560 KB of command skeletons and must not start —
          see `storage/preferences.ts` § PinnedGenerator, and `routes/index.tsx` for the
          rule it follows.
        */}
        {generator.label}
      </Link>

      <span className={`${LABEL} font-mono break-all`}>{generator.id}</span>

      <div className="mt-auto flex items-center gap-2">
        <span className="flex-1" />
        <IconButton
          onClick={onUnpin}
          title={`Unpin ${generator.label}`}
          aria-pressed
          className="text-accent"
        >
          <Icon name="pin" size="sm" />
        </IconButton>
      </div>
    </li>
  )
}
