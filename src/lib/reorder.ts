/**
 * `items` with the entry at `from` moved to sit at `to`.
 *
 * Its own module rather than a helper beside the chain editor for two reasons. A file
 * that exports both a component and a function loses fast refresh, which ESLint says
 * out loud. And this is the half of dragging that can be tested: the rest is pointer
 * geometry, and jsdom answers `getBoundingClientRect` with zeroes, so a test driving a
 * real drag would assert against a layout that does not exist. The arithmetic is what
 * can be wrong in a way a user would notice, so the arithmetic is what is pinned.
 *
 * Out-of-range indices return the list untouched rather than throwing. A pointer can
 * leave a list mid-drag, and a dropped gesture is not an error.
 *
 * Generic because nothing about it is specific to a clause. It is handed instance ids
 * today and would take a saved command or a panel unchanged.
 */
export function moveTo<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return items
  if (from < 0 || from >= items.length) return items
  if (to < 0 || to >= items.length) return items

  const next = [...items]
  const [held] = next.splice(from, 1)
  // Unreachable while `from` is in range, and cheaper than a non-null assertion: the
  // `no-non-null-assertion` path would be the only unchecked thing in this file.
  if (held === undefined) return items
  next.splice(to, 0, held)
  return next
}
