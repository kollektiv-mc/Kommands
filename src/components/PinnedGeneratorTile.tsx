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
 * The link is **stretched over the whole tile** — `absolute inset-0` — rather than
 * wrapping the label alone, so the tile is the target and not just the two words on it.
 * `SavedCommandTile` reaches the same end by a different route, and the difference is
 * the content: that tile carries generated command text worth selecting and copying, so
 * an invisible layer over it would cost something real. There is nothing here but a
 * label and an id, so the link can cover it and keep middle-click working, which a
 * click handler would not.
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
    <li className="border-hairline border-border-subtle bg-surface rounded-panel hover:border-border-hover relative flex min-h-28 flex-col gap-1.5 p-3">
      {/*
        The label snapshotted at pin time, never resolved from the catalogue. The
        dashboard does not load the 560 KB of command skeletons and must not start —
        see `storage/preferences.ts` § PinnedGenerator, and `routes/index.tsx` for the
        rule it follows.

        Named by the label rather than by its own (empty) text, since the visible words
        sit outside it.
      */}
      <Link
        to="/c/$commandId"
        params={{ commandId: generator.id }}
        aria-label={generator.label}
        className="rounded-panel absolute inset-0"
      />

      {/*
        Above the stretched link in paint order but not in hit-testing: `relative`
        raises them, `pointer-events-none` hands every press back down to the link, so
        the tile is one target from edge to edge.
      */}
      <span className="text-text-primary pointer-events-none relative text-left font-mono text-sm font-semibold">
        {generator.label}
      </span>
      <span className={`${LABEL} pointer-events-none relative font-mono break-all`}>
        {generator.id}
      </span>

      {/* The one thing that is not the link. `relative` puts it above, and it keeps its
          own pointer events so it can be pressed. */}
      <div className="relative mt-auto flex items-center gap-2">
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
