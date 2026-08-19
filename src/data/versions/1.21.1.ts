import type { VersionDefinition } from './types'

/**
 * Java Edition 1.21.1.
 *
 * It sits between two breaking changes and is easy to get wrong in both directions:
 * emitting pre-1.20.5 NBT, or emitting post-1.21.5 flattened syntax. Every trait is
 * spelled out rather than inherited for exactly that reason.
 *
 * Note there is no attribute trait. The 1.21.2 attribute rename is a *registry*
 * change, not a syntax one: 1.21.1's registry holds `generic.armor`,
 * `player.mining_efficiency` and `zombie.spawn_reinforcements` — three prefixes, not
 * one — and 1.21.5's holds the bare names. A serializer reads whichever the version's
 * registry gives it, so nothing needs to branch. See docs/minecraft-versions.md
 * § Registry drift.
 */
export const v1_21_1: VersionDefinition = {
  id: '1.21.1',
  mcmetaTag: '1.21.1-summary',
  traits: {
    itemFormat: 'components',
    enchantmentsShape: 'levels-wrapper',
    textComponentFormat: 'json-string',
  },
}
