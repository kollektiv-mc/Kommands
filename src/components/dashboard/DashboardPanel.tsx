import type { ReactNode } from 'react'
import { LABEL } from '../editors/fieldStyles'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'
import { emptySlots, type PanelDescriptor } from './panels'

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
 * The grid lives here rather than in each caller, because the column ramp and the
 * placeholder arithmetic are one decision (`panels.ts` § SLOTS_PER_ROW) and four
 * copies of it would drift the first time one panel wanted a different width.
 */
export function DashboardPanel({
  panel,
  count,
  onRemove,
  children,
}: {
  panel: PanelDescriptor
  /** How many real tiles `children` renders. Drives the count and the empty slots. */
  count: number
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <section className="border-hairline border-border-subtle bg-surface rounded-panel flex flex-col">
      <div className="border-b-hairline border-border-subtle flex items-center gap-2 px-3 py-2">
        <h2 className="font-title text-text-secondary text-1xs">{panel.title}</h2>
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

      <div className="flex flex-col gap-2 p-3">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {children}
          {Array.from({ length: emptySlots(count) }, (_, index) => (
            <EmptySlot key={`slot-${index}`} />
          ))}
        </ul>
        {/*
          Still said, and now underneath the slots rather than instead of them. The
          outlines show there is room; this says what would fill it, which an outline
          cannot. `panels.ts` has carried the sentence since the panels did.
        */}
        {count === 0 && <p className={LABEL}>{panel.empty}</p>}
      </div>
    </section>
  )
}

/**
 * Space for a tile that is not there.
 *
 * `aria-hidden`, and that is not a detail: these are decoration, and a screen reader
 * counting five empty list items before the real one would make an empty panel *worse*
 * to navigate than a blank box. It is also what keeps `getByRole('listitem')` meaning
 * "a command" across the dashboard tests.
 *
 * An outline over nothing, rather than a ghost of a real tile. A ghost invites a
 * click; an outline reads as a slot. The height matches a tile with a name, one line
 * of command text and a control row, so a panel does not resize as it fills up.
 *
 * Two passes settled the weight, and both edges are worth recording because they are
 * close together. A dashed `border-hairline` is invisible: at 0.5px the dashes fall
 * below a device pixel and render as a barely-there smudge, so the affordance said
 * nothing while being perfectly correct in the markup. `border-thick` *with* a
 * `bg-surface` fill went too far the other way — a filled rounded rectangle is a tile,
 * and a panel of them read as content that had failed to load rather than as room.
 *
 * So: the wider border, because dashes need width to read as dashes, and no fill at
 * all, because the fill is what made it a tile. What is left is a line that says
 * "something goes here" and nothing that says "something is here".
 */
function EmptySlot() {
  return (
    <li
      aria-hidden="true"
      className="border-thick border-border-subtle rounded-panel min-h-28 border-dashed"
    />
  )
}
