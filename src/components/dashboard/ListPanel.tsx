import { useState } from 'react'
import type { SavedCommand } from '../../schema/saved'
import { paginate } from '../../lib/paging'
import { useElementSize } from '../../lib/useElementSize'
import { CommandRow, ROW_HEIGHT } from './CommandRow'
import { DashboardPanel } from './DashboardPanel'
import { Pager } from './Pager'

/** Recent, Quick or Linked: one-line rows that page by how many fit the panel. */
export function ListPanel({
  title,
  empty,
  commands,
  collapsed,
  onToggle,
}: {
  title: string
  empty: string
  commands: readonly SavedCommand[]
  collapsed: boolean
  onToggle: () => void
}) {
  const [measure, size] = useElementSize<HTMLUListElement>()
  const [page, setPage] = useState(0)
  const shown = paginate(commands, size ? Math.floor(size.height / ROW_HEIGHT) : 3, page)
  return (
    <DashboardPanel
      title={title}
      count={commands.length}
      collapsed={collapsed}
      onToggle={onToggle}
      className={collapsed ? 'shrink-0' : 'min-h-40 flex-1 lg:min-h-0'}
      controls={<Pager page={shown.page} pages={shown.pages} onPage={setPage} />}
    >
      {commands.length === 0 ? (
        <p className="text-text-secondary p-3.5 text-xs">{empty}</p>
      ) : (
        <ul ref={measure} className="min-h-0 flex-1 overflow-hidden">
          {shown.items.map((saved) => (
            <CommandRow key={saved.id} saved={saved} />
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}
