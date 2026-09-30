import { TEXT_COLORS } from './text-colors'

/**
 * The closed sets a handful of Brigadier parsers accept, for 1.21.1.
 *
 * Authored rather than derived: mcmeta's summaries publish registries, and none of
 * these is one. Each parser fixes its values in code. Checked against minecraft.wiki's
 * Argument types page; a version that changes one (a later one renames
 * `minecraft:color` to `team_color`) changes this file, never an editor.
 */

/** `minecraft:gamemode`. */
export const GAMEMODES: readonly string[] = ['survival', 'creative', 'adventure', 'spectator']

/** `minecraft:entity_anchor`: which part of the entity a facing or offset is taken from. */
export const ENTITY_ANCHORS: readonly string[] = ['feet', 'eyes']

/** `minecraft:heightmap`, as `/execute positioned over` takes it. */
export const HEIGHTMAPS: readonly string[] = [
  'world_surface',
  'motion_blocking',
  'motion_blocking_no_leaves',
  'ocean_floor',
]

/** `minecraft:template_mirror`, for `/place template`. */
export const TEMPLATE_MIRRORS: readonly string[] = ['none', 'front_back', 'left_right']

/** `minecraft:template_rotation`, for `/place template`. */
export const TEMPLATE_ROTATIONS: readonly string[] = [
  'none',
  'clockwise_90',
  '180',
  'counterclockwise_90',
]

/** `minecraft:operation`: `/scoreboard players operation`'s operators. */
export const SCOREBOARD_OPERATIONS: readonly string[] = [
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '><',
  '<',
  '>',
]

/**
 * `minecraft:color`, for `/team modify … color`: the named text colours and `reset`.
 * No `#rrggbb` here, unlike a text component's colour.
 */
export const TEAM_COLORS: readonly string[] = [...TEXT_COLORS, 'reset']
