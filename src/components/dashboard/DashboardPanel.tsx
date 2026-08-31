import type { ReactNode } from 'react'
import { LABEL } from '../editors/fieldStyles'
import type { PanelDescriptor } from './panels'

/**
 * One folder tile on the dashboard: a header, a count, a cross, and a grid of commands.
 *
 * A `<section>` with an `<h2>`, never an `<li>`. The commands inside are the list, and
 * nesting one list inside another would put two `listitem` roles on every tile — which
 * is both wrong for a screen reader and the thing that would break every
 * `getByRole('listitem')` in the dashboard tests.
 *
 * Panel chrome follows Konnekt's `TileWrapper`: hairline border over a translucent
 * surface, header divided by a hairline rule, no shadow anywhere. Elevation in this
 * design language is a surface and a border; there is no shadow token to reach for and
 * `.claude/rules/styling.md` says so in as many words.
 */
export function DashboardPanel({
  panel,
  count,
  onRemove,
  children,
}: {
  panel: PanelDescriptor
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
        <button
          type="button"
          onClick={onRemove}
          aria-label={`remove ${panel.title} panel`}
          className="text-text-faint hover:text-text-primary hover:bg-hover flex h-6 w-6 items-center justify-center rounded"
        >
          {/*
            U+00D7, not U+2715 or U+2716. The multiplication sign is a text glyph in
            every font this app ships; the dingbat crosses render as emoji in some
            stacks, which would put a colour image in a monochrome header. Hidden from
            the accessibility tree because the button already has a name.
          */}
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}
