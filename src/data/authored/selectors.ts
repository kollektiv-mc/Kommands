/**
 * Target selector shorthands.
 *
 * Authored rather than derived: Brigadier describes `minecraft:entity` as an opaque
 * parser with `type` and `amount` properties and says nothing about what a user may
 * type into it. Still versioned data, and still not a literal in a component — which
 * is why it lives here and not in SelectorEditor.
 */
export interface SelectorShorthand {
  token: string
  label: string
  /** Matches exactly one entity, so it is offered when amount is 'single'. */
  single: boolean
  /** Matches only players, so it is offered when type is 'players'. */
  playersOnly: boolean
}

export const SELECTOR_SHORTHANDS: readonly SelectorShorthand[] = [
  { token: '@p', label: 'Nearest player', single: true, playersOnly: true },
  { token: '@r', label: 'Random player', single: true, playersOnly: true },
  { token: '@s', label: 'The executing entity', single: true, playersOnly: false },
  { token: '@a', label: 'All players', single: false, playersOnly: true },
  { token: '@e', label: 'All entities', single: false, playersOnly: false },
]

/** The shorthands legal for a given Brigadier `type`/`amount` pair. */
export function selectorsFor(options: {
  type?: unknown
  amount?: unknown
}): readonly SelectorShorthand[] {
  return SELECTOR_SHORTHANDS.filter(
    (s) =>
      (options.amount !== 'single' || s.single) && (options.type !== 'players' || s.playersOnly),
  )
}
