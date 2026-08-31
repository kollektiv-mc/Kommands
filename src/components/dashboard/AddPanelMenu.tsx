import { useState } from 'react'
import { panelById, type PanelId } from './panels'
import { LABEL } from '../editors/fieldStyles'

const BUTTON =
  'border-hairline border-border-subtle bg-surface text-text-primary hover:border-border-hover ' +
  'rounded-md px-2 py-1 font-mono text-1xs'

/**
 * How a removed panel comes back.
 *
 * Without this the cross is a one-way door, and a dashboard with every panel removed is
 * a dead end — which is the failure mode that makes "removable" a worse feature than
 * "fixed". It stays reachable in exactly that case: it lives in the dashboard header,
 * which renders whether or not any panel does.
 *
 * Plain buttons in a `<div>`, deliberately not a `<ul>`. A list here would add
 * `listitem` roles to the dashboard, and the command tiles are the only things that
 * should own that role — six tests query `getByRole('listitem')` expecting a command.
 */
export function AddPanelMenu({
  removed,
  onRestore,
}: {
  removed: readonly PanelId[]
  onRestore: (id: PanelId) => void
}) {
  const [open, setOpen] = useState(false)

  // Nothing to add is not an empty menu, it is no menu. A control that opens to say
  // "nothing here" is worse than a control that is not offered.
  if (removed.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className={BUTTON}
      >
        {`Add panel (${removed.length})`}
      </button>
      {open && (
        <div className="border-hairline border-border-subtle bg-overlay rounded-panel absolute right-0 z-10 mt-1 flex min-w-32 flex-col p-1">
          {removed.map((id) => {
            const panel = panelById(id)
            if (!panel) return null
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onRestore(id)
                  setOpen(false)
                }}
                className={`hover:bg-hover rounded px-2 py-1 text-left ${LABEL}`}
              >
                {panel.title}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
