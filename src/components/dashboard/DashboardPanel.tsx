import type { ReactNode } from 'react'
import { LABEL } from '../editors/fieldStyles'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'
import { Collapsible } from '../ui/Collapsible'
import type { PanelDescriptor } from './panels'

/**
 * One organizer on the dashboard: a header, a count, its controls, and a grid of tiles.
 *
 * A `<section>` with an `<h2>`, never an `<li>`. The tiles inside are the list, and
 * nesting one list inside another would put two `listitem` roles on every panel — which
 * is both wrong for a screen reader and the thing that would break every
 * `getByRole('listitem')` in the dashboard tests.
 *
 * Panel chrome follows Konnekt's `TileWrapper`: hairline border over a translucent
 * surface, header divided by a hairline rule, no shadow anywhere. Elevation in this
 * design language is a surface and a border; there is no shadow token to reach for and
 * `.claude/rules/styling.md` says so in as many words.
 *
 * **The grid pads nothing.** It used to draw dashed outlines to finish the row — six
 * of them for an empty panel — on the reasoning that an outline says "there is room
 * here" where a bare sentence says "this feature is missing". That reasoning holds for
 * one empty panel and not for four: a dashboard nobody has saved to opened as
 * twenty-four dashed rectangles, and every panel reserved a full row of height it had
 * no content for, so a window small enough to need the space spent it on placeholders.
 * A row now holds what there is, and wraps to a second line only when there is a second
 * line's worth of commands.
 */
export function DashboardPanel({
  panel,
  count,
  collapsed,
  onToggle,
  onRemove,
  children,
}: {
  panel: PanelDescriptor
  /** How many real tiles `children` renders. Drives the count and the empty sentence. */
  count: number
  collapsed: boolean
  onToggle: () => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <section className="border-hairline border-border-subtle bg-surface rounded-panel flex flex-col">
      <div
        className={`flex items-center gap-2 px-3 py-2 ${
          // The rule separates the header from the body, so a collapsed panel has
          // nothing for it to separate — drawn there it lands a hairline above the
          // section's own bottom border and the two read as one thick edge. The colour
          // goes rather than the width, so the header keeps its height and the line
          // fades with the body instead of vanishing the instant it is clicked.
          // Konnekt's `NavSection` reaches the same conclusion in the same words.
          collapsed
            ? 'border-b-hairline border-b-transparent'
            : 'border-b-hairline border-b-border-subtle'
        }`}
      >
        {/*
          The heading wraps the button rather than the other way round. A `<button>`
          takes phrasing content and an `<h2>` is flow content, so a heading inside a
          control is invalid HTML — and the alternative, dropping the heading for a
          span, would take `getByRole('heading')` away from every dashboard test and
          the section landmark structure away from anyone navigating by heading.

          The count stays outside it for the same naming reason: inside, the heading
          would be called "Saved commands 1" and change its own accessible name every
          time a command was saved.

          One glyph that rotates rather than two that swap. A lucide chevron's ink is
          centred in its box, so the rotation is a turn rather than a lurch, and a
          disclosure marker that *travels* between its two states is the part that
          reads as a hinge.
        */}
        <h2 className="min-w-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="hover:text-text-primary flex cursor-pointer items-center gap-2 text-left select-none"
          >
            <Icon
              name="chevronDown"
              size="sm"
              className={`text-text-faint duration-fast shrink-0 transition-transform ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
            <span className="font-title text-text-secondary text-1xs truncate">{panel.title}</span>
          </button>
        </h2>
        <span className={LABEL}>{count}</span>
        <span className="flex-1" />
        {/*
          Present and disabled, which is this codebase's own answer to a control that
          is coming rather than absent — `SavedCommandTile` states it for the Konnekt
          link, and `distribution.md` § The split must be visible names the failure it
          avoids: someone learning a thing is missing by finding nothing where they
          expected something. The design is in place; the reason it does nothing yet is
          in the accessible name rather than only in a tooltip, because a `title` is
          discovered on hover and that is the same failure one level down.
        */}
        <IconButton
          disabled
          title={`Maximize ${panel.title} — not yet available`}
          className="titlebar-no-drag"
        >
          <Icon name="maximize" size="sm" />
        </IconButton>
        <IconButton onClick={onRemove} title={`Remove ${panel.title} panel`}>
          <Icon name="close" size="sm" />
        </IconButton>
      </div>

      {/*
        Collapsed hides the body, it does not unmount it. The height has to be
        measurable for the animation to travel anywhere, and a panel that threw its
        tiles away would re-mount every one of them — remeasuring the fingerprint
        verdict and losing any half-typed rename — the moment it was opened again.
      */}
      <Collapsible open={!collapsed}>
        <div className="flex flex-col gap-2 p-3">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {children}
          </ul>
          {/* The only thing an empty panel draws now. An outline could show there was
              room; only a sentence can say what the room is for, and it turns out to be
              the half worth keeping. */}
          {count === 0 && <p className={LABEL}>{panel.empty}</p>}
        </div>
      </Collapsible>
    </section>
  )
}
