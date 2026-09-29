import type { ArgumentNode, CommandDefinition, Node } from '../../../schema/types'
import { argumentNodesFor } from '../../../schema/addressing'

/**
 * What the game assumes for an optional argument that is left out.
 *
 * Keyed by command id, then by the same selectors constraints use (see
 * `src/schema/addressing.ts`), and written in each argument type's own value shape:
 * numbers for numeric types, booleans for `bool`, strings for everything else.
 *
 * Only arguments a later part can force are worth an entry, since that is the one time
 * a default reaches the output. Every value is the one minecraft.wiki documents for
 * Java Edition and was checked there, not inferred. An argument whose default depends
 * on something else is deliberately absent: `/effect give`'s duration is 30 seconds for
 * most effects and one tick for `instant_damage`, `instant_health` and `saturation`, and
 * `/playsound`'s position is each *target's* position, which `~ ~ ~` would not
 * reproduce from a command block. Those are written as their `<name>` placeholder when
 * forced, which asks rather than guesses.
 */
const DEFAULTS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  'vanilla:effect': {
    'clear/targets': '@s',
    'give/amplifier': 0,
    'infinite/amplifier': 0,
  },
  'vanilla:particle': {
    pos: '~ ~ ~',
    delta: '0 0 0',
    speed: 0,
  },
  'vanilla:place': {
    rotation: 'none',
    mirror: 'none',
    integrity: 1,
  },
  'vanilla:playsound': Object.fromEntries(
    [
      'ambient',
      'block',
      'hostile',
      'master',
      'music',
      'neutral',
      'player',
      'record',
      'voice',
      'weather',
    ].flatMap((source) => [
      [`${source}/targets`, '@s'],
      [`${source}/volume`, 1],
      [`${source}/pitch`, 1],
    ]),
  ),
  'vanilla:publish': {
    allowCommands: false,
  },
  'vanilla:random': {
    '*/includeWorldSeed': true,
    '*/includeSequenceId': true,
    'reset/includeWorldSeed': true,
    'reset/includeSequenceId': true,
  },
  'vanilla:setworldspawn': {
    pos: '~ ~ ~',
  },
  'vanilla:spawnpoint': {
    targets: '@s',
    pos: '~ ~ ~',
  },
  'vanilla:summon': {
    pos: '~ ~ ~',
  },
  'vanilla:transfer': {
    port: 25565,
  },
}

/** Every authored default, for the invariant test. */
export function authoredDefaults(): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return DEFAULTS
}

/**
 * The definition with its authored defaults written into its argument nodes.
 *
 * Rewritten rather than mutated: the derived tree is shared with everything else that
 * loaded it. A selector that names no node, or more than one, attaches nothing here;
 * `defaults.test.ts` is what fails on it, the way invariant 7 fails a constraint.
 */
export function withDefaults(definition: CommandDefinition): CommandDefinition {
  const entries = DEFAULTS[definition.id]
  if (!entries) return definition
  const values = new Map<Node, unknown>()
  for (const [selector, value] of Object.entries(entries)) {
    const nodes = argumentNodesFor(definition.root, selector)
    if (nodes.length === 1 && nodes[0]) values.set(nodes[0], value)
  }
  return values.size === 0 ? definition : { ...definition, root: rewrite(definition.root, values) }
}

function rewrite(node: Node, values: ReadonlyMap<Node, unknown>): Node {
  switch (node.kind) {
    case 'argument':
      return values.has(node)
        ? ({ ...node, default: values.get(node) } satisfies ArgumentNode)
        : node
    case 'sequence':
    case 'choice':
      return { ...node, nodes: node.nodes.map((n) => rewrite(n, values)) }
    case 'repeat':
      return { ...node, node: rewrite(node.node, values) }
    case 'literal':
    case 'flagset':
    case 'ref':
      return node
  }
}
