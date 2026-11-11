/**
 * One page of a list, and what a pager needs to move between pages.
 *
 * The dashboard never scrolls: each panel shows as many items as fit and pages the
 * rest. `page` is clamped, so a list that shrinks under the current page lands on its
 * last page rather than on an empty one.
 */
export interface Page<T> {
  items: readonly T[]
  page: number
  pages: number
}

export function paginate<T>(items: readonly T[], perPage: number, page: number): Page<T> {
  const per = Math.max(1, Math.floor(perPage))
  const pages = Math.max(1, Math.ceil(items.length / per))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { items: items.slice(at * per, at * per + per), page: at, pages }
}

/**
 * How many cells of `cell` px, `gap` px apart, fit in `space` px. At least one, so a
 * panel squeezed below one cell still shows something.
 */
export function fit(space: number, cell: number, gap = 0): number {
  return Math.max(1, Math.floor((space + gap) / (cell + gap)))
}
