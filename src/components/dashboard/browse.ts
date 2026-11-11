import type { SavedCommand } from '../../schema/saved'

export type BrowseMode = 'group' | 'generator' | 'list'

/** The heading a command without a group sits under. */
export const UNGROUPED = 'Ungrouped'

/**
 * Whether a command matches a search and the tags picked as filters.
 *
 * Every picked tag must be on it. Every word of the query must appear in its name,
 * command, generator, group or tags; a word starting with `#` matches the start of a
 * tag and nothing else.
 */
export function matches(command: SavedCommand, query: string, picked: readonly string[]): boolean {
  const tags = command.tags ?? []
  if (!picked.every((tag) => tags.includes(tag))) return false
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hay = [
    command.name,
    command.preview,
    command.definitionId,
    command.group ?? UNGROUPED,
    ...tags,
  ]
    .join(' ')
    .toLowerCase()
  return words.every((word) =>
    word.startsWith('#') ? tags.some((tag) => tag.startsWith(word.slice(1))) : hay.includes(word),
  )
}

export interface Section {
  /** Null in List mode, where nothing is grouped. */
  heading: string | null
  commands: readonly SavedCommand[]
}

/**
 * The browser's list, split into sections for the chosen mode.
 *
 * By group, every known group shows even when empty, so something can be dragged into
 * it, unless a search or filter is active, which hides what it emptied. Ungrouped comes
 * last. By generator, only generators with a match show, in id order.
 */
export function sections(
  hits: readonly SavedCommand[],
  mode: BrowseMode,
  groups: readonly string[],
  filtering: boolean,
): Section[] {
  if (mode === 'list') return [{ heading: null, commands: hits }]
  const keyOf = (c: SavedCommand) => (mode === 'group' ? (c.group ?? UNGROUPED) : c.definitionId)
  const names =
    mode === 'group'
      ? [...knownGroups(hits, groups), UNGROUPED]
      : [...new Set(hits.map(keyOf))].sort()
  return names
    .map((heading) => ({ heading, commands: hits.filter((c) => keyOf(c) === heading) }))
    .filter((section) => section.commands.length > 0 || (mode === 'group' && !filtering))
}

/** The groups the store offers, then any a command is filed under that it does not. */
export function knownGroups(
  commands: readonly SavedCommand[],
  groups: readonly string[],
): string[] {
  const filed = commands.map((c) => c.group).filter((g): g is string => g !== undefined)
  return [...new Set([...groups, ...filed.toSorted()])]
}

/** Every tag in use, sorted, for the filter chips. */
export function allTags(commands: readonly SavedCommand[]): string[] {
  return [...new Set(commands.flatMap((c) => c.tags ?? []))].sort()
}
