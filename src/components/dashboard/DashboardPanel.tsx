import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'

/**
 * One organizer on the dashboard: a header band with the title, a count and the
 * panel's own controls, over a body that pages rather than scrolls.
 *
 * A `<section>` with an `<h2>`, never an `<li>`, so the tiles inside are the only list
 * items on the page. The heading wraps the toggle button, not the other way round: a
 * heading inside a button is invalid HTML. The count sits outside the button so the
 * heading's name does not change every time a command is saved.
 *
 * Collapsing unmounts the body. The dashboard does not scroll, so the space a closed
 * panel gives up goes to its neighbours, which is why `className` sizes the section
 * from outside.
 */
export function DashboardPanel({
  title,
  count,
  collapsed,
  onToggle,
  controls,
  className = '',
  children,
}: {
  title: string
  count: number
  collapsed: boolean
  onToggle: () => void
  /** The pager and anything else that sits at the right of the header. */
  controls?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`border-hairline border-border-subtle bg-elevated rounded-panel flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
    >
      <div className="bg-hover border-b-hairline border-border-subtle flex shrink-0 items-center gap-2.5 py-1.5 pr-2 pl-3">
        <h2 className="min-w-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="font-title text-text-primary flex cursor-pointer items-center gap-2 text-sm font-semibold whitespace-nowrap select-none"
          >
            <Icon
              name="chevronDown"
              className={`text-text-muted duration-fast shrink-0 transition-transform ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
            {title}
          </button>
        </h2>
        <span className="border-hairline border-border-subtle bg-elevated text-text-secondary text-1xs rounded-sm px-1.5 py-px font-mono tabular-nums">
          {count}
        </span>
        <span className="flex-1" />
        {controls}
      </div>
      {!collapsed && children}
    </section>
  )
}
