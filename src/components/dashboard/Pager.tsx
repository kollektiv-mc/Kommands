import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'

/** ‹ 1 / 2 ›, for a panel that pages rather than scrolls. Nothing when one page holds it all. */
export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
}) {
  if (pages <= 1) return null
  return (
    <span className="text-text-secondary text-1xs flex items-center gap-0.5 font-mono">
      <IconButton
        small
        title="Previous page"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        <Icon name="chevronLeft" size="sm" />
      </IconButton>
      <span className="min-w-9 text-center tabular-nums">{`${page + 1} / ${pages}`}</span>
      <IconButton
        small
        title="Next page"
        disabled={page === pages - 1}
        onClick={() => onPage(page + 1)}
      >
        <Icon name="chevronRight" size="sm" />
      </IconButton>
    </span>
  )
}
