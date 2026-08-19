import type { ArgumentTypeKey } from '../../schema/types'

/**
 * Brigadier parser -> argument type, for every parser the pinned command tree uses.
 *
 * This is the bridge between derivation and the argument-type registry, and it is
 * data rather than code because parser names are versioned: a future Minecraft
 * version can add one, and when it does this table is where that shows up.
 *
 * `kind` drives the deriver's failure policy, which is deliberately asymmetric —
 * see .claude/rules/generated-data.md:
 *
 *   shallow  a plain scalar. It must be generically representable, so an entry
 *            whose `type` has no registered editor is a hard error: failing to map
 *            a scalar means the deriver misunderstands a type used across many
 *            commands.
 *   deep     a structured value. An entry with no registered editor yet binds the
 *            raw_text fallback and records the gap, so an unsupported command
 *            degrades to a text field rather than breaking the build.
 *
 * The policy only means something if the two are distinguishable, which is why the
 * table covers all 51 parsers rather than only the ones in the acceptance set, and
 * why `lookupParser` throws on a parser that is absent. Failing closed is the point:
 * an unknown parser silently binding raw_text is how a scalar would degrade to a
 * text field without anyone noticing.
 *
 * Measured against misode/mcmeta 1.21.1-summary: 51 parsers over 1763 nodes,
 * 41 shallow (763 uses) and 10 deep (183 uses).
 */
export interface ParserBinding {
  kind: 'shallow' | 'deep'
  type: ArgumentTypeKey
}

export const PARSERS: Readonly<Record<string, ParserBinding>> = {
  // Brigadier scalars
  'brigadier:integer': { kind: 'shallow', type: 'integer' }, // 137 uses
  'brigadier:bool': { kind: 'shallow', type: 'bool' }, // 53 uses
  'brigadier:double': { kind: 'shallow', type: 'double' }, // 46 uses
  'brigadier:float': { kind: 'shallow', type: 'float' }, // 38 uses
  'brigadier:string': { kind: 'shallow', type: 'string' }, // 15 uses

  // Positions, rotations, axes
  'minecraft:block_pos': { kind: 'shallow', type: 'block_pos' }, // 92 uses
  'minecraft:vec3': { kind: 'shallow', type: 'vec3' }, // 20 uses
  'minecraft:column_pos': { kind: 'shallow', type: 'column_pos' }, // 5 uses
  'minecraft:vec2': { kind: 'shallow', type: 'vec2' }, // 2 uses
  'minecraft:rotation': { kind: 'shallow', type: 'rotation' }, // 2 uses
  'minecraft:angle': { kind: 'shallow', type: 'angle' }, // 2 uses
  'minecraft:swizzle': { kind: 'shallow', type: 'swizzle' }, // 1 use

  // Selectors and identities
  'minecraft:entity': { kind: 'shallow', type: 'entity_selector' }, // 110 uses
  'minecraft:score_holder': { kind: 'shallow', type: 'score_holder' }, // 27 uses
  'minecraft:game_profile': { kind: 'shallow', type: 'entity_selector' }, // 6 uses
  'minecraft:team': { kind: 'shallow', type: 'team' }, // 5 uses

  // Registry-backed identifiers
  'minecraft:resource_location': { kind: 'shallow', type: 'resource_location' }, // 75 uses
  'minecraft:objective': { kind: 'shallow', type: 'objective' }, // 28 uses
  'minecraft:loot_table': { kind: 'shallow', type: 'resource_location' }, // 14 uses
  'minecraft:resource': { kind: 'shallow', type: 'resource_location' }, // 8 uses
  'minecraft:dimension': { kind: 'shallow', type: 'resource_location' }, // 6 uses
  'minecraft:loot_modifier': { kind: 'shallow', type: 'resource_location' }, // 6 uses
  'minecraft:resource_or_tag': { kind: 'shallow', type: 'resource_location' }, // 5 uses
  'minecraft:function': { kind: 'shallow', type: 'resource_location' }, // 5 uses
  'minecraft:resource_key': { kind: 'shallow', type: 'resource_location' }, // 3 uses
  'minecraft:loot_predicate': { kind: 'shallow', type: 'resource_location' }, // 2 uses
  'minecraft:resource_or_tag_key': { kind: 'shallow', type: 'resource_location' }, // 1 use
  'minecraft:objective_criteria': { kind: 'shallow', type: 'objective_criteria' }, // 1 use

  // Closed enumerations
  'minecraft:item_slot': { kind: 'shallow', type: 'item_slot' }, // 10 uses
  'minecraft:item_slots': { kind: 'shallow', type: 'item_slots' }, // 4 uses
  'minecraft:gamemode': { kind: 'shallow', type: 'gamemode' }, // 3 uses
  'minecraft:entity_anchor': { kind: 'shallow', type: 'entity_anchor' }, // 3 uses
  'minecraft:heightmap': { kind: 'shallow', type: 'heightmap' }, // 1 use
  'minecraft:scoreboard_slot': { kind: 'shallow', type: 'scoreboard_slot' }, // 1 use
  'minecraft:operation': { kind: 'shallow', type: 'operation' }, // 1 use
  'minecraft:color': { kind: 'shallow', type: 'color' }, // 1 use
  'minecraft:template_mirror': { kind: 'shallow', type: 'template_mirror' }, // 1 use
  'minecraft:template_rotation': { kind: 'shallow', type: 'template_rotation' }, // 1 use

  // Scalars with their own small syntax
  'minecraft:time': { kind: 'shallow', type: 'time' }, // 11 uses
  'minecraft:message': { kind: 'shallow', type: 'message' }, // 7 uses
  'minecraft:int_range': { kind: 'shallow', type: 'int_range' }, // 4 uses

  // Deep — structured values needing a hand-authored editor
  'minecraft:nbt_path': { kind: 'deep', type: 'nbt_path' }, // 114 uses
  'minecraft:item_stack': { kind: 'deep', type: 'item_stack' }, // 17 uses
  'minecraft:component': { kind: 'deep', type: 'text_component' }, // 15 uses
  'minecraft:nbt_tag': { kind: 'deep', type: 'nbt_tag' }, // 15 uses
  'minecraft:block_predicate': { kind: 'deep', type: 'block_predicate' }, // 7 uses
  'minecraft:nbt_compound_tag': { kind: 'deep', type: 'nbt_compound' }, // 5 uses
  'minecraft:item_predicate': { kind: 'deep', type: 'item_predicate' }, // 5 uses
  'minecraft:block_state': { kind: 'deep', type: 'block_state' }, // 2 uses
  'minecraft:style': { kind: 'deep', type: 'style' }, // 2 uses
  'minecraft:particle': { kind: 'deep', type: 'particle' }, // 1 use
}

/**
 * The binding for a parser, or a hard error naming it.
 *
 * Throwing is the whole design. Returning a raw_text fallback for an unknown parser
 * would make every future Minecraft version's new scalar arrive as a silently
 * degraded text field — indistinguishable, from the outside, from one that was
 * deliberately left deep.
 */
export function lookupParser(parser: string): ParserBinding {
  // Object.hasOwn, not a truthiness check: PARSERS is an object literal, so it
  // inherits Object.prototype and `PARSERS['constructor']` returns a function. A
  // plain `if (!binding)` therefore accepted 'constructor', 'toString' and friends
  // as valid parsers and handed back the prototype member.
  const binding = Object.hasOwn(PARSERS, parser) ? PARSERS[parser] : undefined
  if (!binding) {
    throw new Error(
      `unknown Brigadier parser: ${parser}. Add it to src/data/authored/parsers.ts with ` +
        `an explicit kind — shallow if it is a scalar, deep if it needs a hand-authored ` +
        `editor. See .claude/rules/generated-data.md for why this fails rather than ` +
        `falling back to raw_text.`,
    )
  }
  return binding
}

/**
 * Deep parsers whose argument type has no editor registered yet.
 *
 * The gap the failure policy asks derivation to *record* rather than fail on. It is
 * computed rather than listed so it shrinks by itself as editors land — item_stack
 * leaves with #7, text_component with #8 — instead of becoming a stale list nobody
 * updates.
 *
 * A shallow parser in the same position is not a gap: a scalar is generically
 * representable, so a text field is a plainer editor rather than a missing one. For a
 * deep parser it is the product itself that is missing — the user hand-writes the
 * syntax the app exists to build.
 */
export function unimplementedDeepParsers(isRegistered: (type: ArgumentTypeKey) => boolean) {
  return Object.entries(PARSERS)
    .filter(([, binding]) => binding.kind === 'deep' && !isRegistered(binding.type))
    .map(([parser, binding]) => ({ parser, type: binding.type }))
}
