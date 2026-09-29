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
  /**
   * Accepted by an argument limited to players.
   *
   * Not the same as "matches only players", which is what this used to say and why
   * `@s` was left out: `/give @s …` was flagged as invalid, though it is how most
   * people give themselves anything. Java Edition reads `@s` as a player-type selector
   * and fails only at run time if the executor is not a player. `@e` and `@n` can
   * select any entity, and a player-only argument refuses to parse them.
   */
  playerType: boolean
}

export const SELECTOR_SHORTHANDS: readonly SelectorShorthand[] = [
  { token: '@p', label: 'Nearest player', single: true, playerType: true },
  { token: '@r', label: 'Random player', single: true, playerType: true },
  { token: '@s', label: 'The executing entity', single: true, playerType: true },
  { token: '@a', label: 'All players', single: false, playerType: true },
  { token: '@e', label: 'All entities', single: false, playerType: false },
  // Added in 1.21, the version this app targets.
  { token: '@n', label: 'Nearest entity', single: true, playerType: false },
]

/** The shorthands legal for a given Brigadier `type`/`amount` pair. */
export function selectorsFor(options: {
  type?: unknown
  amount?: unknown
}): readonly SelectorShorthand[] {
  return SELECTOR_SHORTHANDS.filter(
    (s) =>
      (options.amount !== 'single' || s.single) && (options.type !== 'players' || s.playerType),
  )
}
