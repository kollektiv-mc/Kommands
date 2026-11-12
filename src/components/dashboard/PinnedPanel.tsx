import { useState } from 'react'
import { fit, paginate } from '../../lib/paging'
import { useElementSize } from '../../lib/useElementSize'
import type { PinnedGenerator } from '../../storage/preferences'
import { PinnedGeneratorTile } from '../PinnedGeneratorTile'
import { DashboardPanel } from './DashboardPanel'
import { Pager } from './Pager'

/** A generator card's least width and the gap between cards, in px. */
const CARD_WIDTH = 200
const GAP = 12

/** Pinned generators: one row of cards across the top, paging when there are more. */
export function PinnedPanel({
  generators,
  empty,
  collapsed,
  onToggle,
  onUnpin,
}: {
  generators: readonly PinnedGenerator[]
  empty: string
  collapsed: boolean
  onToggle: () => void
  onUnpin: (generator: PinnedGenerator) => void
}) {
  const [measure, size] = useElementSize<HTMLDivElement>()
  const [page, setPage] = useState(0)
  const cols = size ? fit(size.width, CARD_WIDTH, GAP) : 6
  const shown = paginate(generators, cols, page)
  return (
    <DashboardPanel
      title="Pinned generators"
      count={generators.length}
      collapsed={collapsed}
      onToggle={onToggle}
      className="shrink-0"
      controls={<Pager page={shown.page} pages={shown.pages} onPage={setPage} />}
    >
      <div ref={measure} className="m-3.5">
        {generators.length === 0 ? (
          <p className="text-text-secondary text-xs">{empty}</p>
        ) : (
          <ul
            // eslint-disable-next-line no-restricted-syntax -- the column count is measured at runtime, which no static class can carry
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            className="grid gap-3"
          >
            {shown.items.map((generator) => (
              <PinnedGeneratorTile
                key={generator.id}
                generator={generator}
                onUnpin={() => onUnpin(generator)}
              />
            ))}
          </ul>
        )}
      </div>
    </DashboardPanel>
  )
}
