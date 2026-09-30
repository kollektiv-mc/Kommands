/**
 * The pure half of `components/ui/Listbox` and `components/ui/Combobox`: matching and
 * typeahead, with no React in them, so the list behaviour is tested directly.
 *
 * Ported from Konnekt's `lib/combobox.ts`, which has the same two answers for the same
 * two controls. The suite shares tokens rather than components, so the copy is
 * deliberate; keep the two in step when either changes behaviour.
 */

/** One entry in a list: what is stored, what is shown, and an optional line under it. */
export interface ListOption<V extends string = string> {
  value: V
  label: string
  description?: string
}

/**
 * Options whose label or value contains `query`, case-insensitively.
 *
 * Substring rather than prefix: registry ids are namespaced, and
 * the half anyone remembers is `sword`, not the namespace.
 */
export function filterOptions<V extends string>(
  options: readonly ListOption<V>[],
  query: string,
): ListOption<V>[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...options]
  return options.filter(
    (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
  )
}

/**
 * The index a native `<select>` typeahead would land on: the first option whose label
 * starts with `buffer`, searching forward from `from` and wrapping. -1 when nothing
 * matches, which the caller reads as "leave the highlight alone".
 */
export function typeaheadIndex(
  options: readonly ListOption[],
  buffer: string,
  from: number = 0,
): number {
  let b = buffer.trim().toLowerCase()
  if (!b || options.length === 0) return -1
  // One letter pressed repeatedly cycles through the options starting with it, as a
  // native select does, rather than searching for "gg" and finding nothing.
  if ([...b].every((c) => c === b[0])) b = b[0]!
  for (let i = 0; i < options.length; i++) {
    const at = (from + i) % options.length
    if (options[at]?.label.toLowerCase().startsWith(b)) return at
  }
  return -1
}

/** One step through `count` items from `from`, wrapping at both ends. -1 enters at an end. */
export function stepIndex(from: number, delta: number, count: number): number {
  if (count === 0) return -1
  if (from < 0) return delta > 0 ? 0 : count - 1
  return (((from + delta) % count) + count) % count
}

/** The DOM id of option `index` in the list `listId`, for `aria-activedescendant`. */
export const optionId = (listId: string, index: number): string => `${listId}-option-${index}`
