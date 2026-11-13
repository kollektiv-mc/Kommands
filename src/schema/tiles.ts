import { lookupArgumentType } from './argument-types'
import { branch, child, choiceSelection, NO_BRANCH, ROOT, type Path } from './paths'
import { branchLabel, chainTail, choiceControl, choiceRows, NO_BRANCH_LABEL } from './presentation'
import type { CommandValue } from './serialize'
import { REF_ANY, type CommandDefinition, type Node, type UiMetadata } from './types'
import type { LayoutTile, TileSize } from '../lib/tileLayout'

type ChoiceNode = Extract<Node, { kind: 'choice' }>

/**
 * One tile of the editor, as the walk found it.
 *
 * A definition is a tree and the editor is a grid, so the walk flattens it: a choice is
 * a tile that picks the branch, followed by the tiles of the branch it picked. A
 * keyword is no tile at all. A chain of steps, or an embedded command's picker, are
 * tiles like any other; the chain is one that fills a column. Everything a tile needs
 * to render is here, so the renderer draws an entry without walking again.
 */
export type TileEntry = {
  /** The node's path, which is also the tile's identity across renders. */
  key: Path
  size: TileSize
  /** Authored presentation for the definition this node belongs to. */
  ui?: UiMetadata
  /** The keywords above the node, which `ui.arguments` selectors match against. */
  literals: readonly string[]
  /** How many more Refs may be entered below this one. */
  depth: number
  /** The tile needs the sheet's full width, so it takes a band below the columns. */
  wide?: boolean
} & (
  | { kind: 'argument'; node: Extract<Node, { kind: 'argument' }> }
  | { kind: 'choice'; node: ChoiceNode }
  | { kind: 'flags'; node: Extract<Node, { kind: 'flagset' }> }
  | { kind: 'ref'; node: Extract<Node, { kind: 'ref' }> }
  | {
      kind: 'chain'
      node: Extract<Node, { kind: 'repeat' }>
      /** The Choice that ends the chain (`chainTail`), drawn as its last step. */
      tail?: { node: ChoiceNode; path: Path }
    }
  | { kind: 'preview' }
)

interface Walk {
  /**
   * Which branch each Choice is on: the live value, or, to find a command's busiest
   * state, the branch with the most tiles under it.
   */
  pick: (node: ChoiceNode, path: Path, scope: Scope) => number
  /** Which command a `@any` Ref embeds, if any. */
  refTarget: (path: Path) => CommandDefinition | undefined
}

interface Scope {
  ui?: UiMetadata
  literals: readonly string[]
  depth: number
  catalogue: Readonly<Record<string, CommandDefinition>>
}

const MAX_DEPTH = 8

/** The tiles for a command's current value, in argument order. */
export function tilesFor(
  definition: CommandDefinition,
  value: CommandValue,
  catalogue: Readonly<Record<string, CommandDefinition>> = {},
): TileEntry[] {
  const walk: Walk = {
    pick: (node, path) => choiceSelection(value.choices, path, node),
    refTarget: (path) => catalogue[value.refs[path] ?? ''],
  }
  return withPreview(
    definition,
    collect(definition.root, ROOT, walk, {
      ui: definition.ui,
      literals: [],
      depth: MAX_DEPTH,
      catalogue,
    }),
  )
}

/**
 * The tile sizes of a command's busiest state: every Choice on the branch with the
 * most rows under it. What the editor decides the command's column count from, so the
 * sheet keeps its width while choices add and remove tiles.
 */
export function busiestSizes(definition: CommandDefinition): TileSize[] {
  const rowsOf = (entries: readonly TileEntry[]) =>
    entries.reduce((n, e) => n + (e.size === 'fill' ? 0 : e.size), 0)
  const walk: Walk = {
    pick: (node, path, scope) => {
      let best = node.optional ? NO_BRANCH : 0
      let most = -1
      node.nodes.forEach((n, i) => {
        const rows = rowsOf(collect(n, branch(path, i), walk, scope))
        if (rows > most) [best, most] = [i, rows]
      })
      return best
    },
    // An embedded command is chosen by the user, so it has no busiest state of its own.
    refTarget: () => undefined,
  }
  const entries = collect(definition.root, ROOT, walk, {
    ui: definition.ui,
    literals: [],
    depth: MAX_DEPTH,
    catalogue: {},
  })
  // A wide tile takes a band of its own below the columns, so it does not count.
  return withPreview(definition, entries).flatMap((e) => (e.wide ? [] : [e.size]))
}

/** The most states `tileStates` walks. */
const STATE_LIMIT = 64

/**
 * The tiles of the states a command can be in, for the editor to plan its columns
 * against (`planColumns`), so that a choice never moves a tile to another column.
 *
 * Breadth first from every choice on its first branch: each state found queues one
 * more per other branch of each choice it shows, so up to `STATE_LIMIT` the states
 * that differ from the first by one choice all come before any that differ by two,
 * and every branch near the top is seen before a combination deep down. An embedded
 * command is chosen by the user, so `@any` Refs contribute nothing here.
 */
export function tileStates(
  definition: CommandDefinition,
  catalogue: Readonly<Record<string, CommandDefinition>> = {},
): LayoutTile[][] {
  const states: LayoutTile[][] = []
  const queue: ReadonlyMap<Path, number>[] = [new Map()]
  const seen = new Set<string>([''])
  for (let next = 0; next < queue.length && states.length < STATE_LIMIT; next++) {
    const picks = queue[next]!
    const met: { path: Path; options: number[] }[] = []
    const walk: Walk = {
      pick: (node, path) => {
        const options = node.nodes.map((_, i) => i)
        if (node.optional) options.unshift(NO_BRANCH)
        if (!picks.has(path)) met.push({ path, options })
        return picks.get(path) ?? options[0]!
      },
      refTarget: () => undefined,
    }
    const entries = collect(definition.root, ROOT, walk, {
      ui: definition.ui,
      literals: [],
      depth: MAX_DEPTH,
      catalogue,
    })
    states.push(
      withPreview(definition, entries).map(({ key, size, wide }) => ({ key, size, wide })),
    )
    for (const { path, options } of met) {
      for (const option of options.slice(1)) {
        const more = new Map(picks).set(path, option)
        const id = [...more]
          .map(([p, o]) => `${p}=${o}`)
          .sort()
          .join(',')
        if (!seen.has(id)) {
          seen.add(id)
          queue.push(more)
        }
      }
    }
  }
  return states
}

function withPreview(definition: CommandDefinition, entries: TileEntry[]): TileEntry[] {
  if (definition.preview === undefined) return entries
  return [...entries, { kind: 'preview', key: '#preview', size: 'fill', literals: [], depth: 0 }]
}

function collect(node: Node, path: Path, walk: Walk, scope: Scope): TileEntry[] {
  const base = { key: path, ui: scope.ui, literals: scope.literals, depth: scope.depth }
  switch (node.kind) {
    case 'literal':
      return []

    case 'argument': {
      const type = lookupArgumentType(node.type)
      return [{ ...base, kind: 'argument', node, size: type.tile ?? 2, wide: type.wideTile }]
    }

    case 'flagset':
      return [{ ...base, kind: 'flags', node, size: node.flags.length > 3 ? 3 : 2 }]

    case 'sequence': {
      const chain = chainTail(node.nodes)
      const out: TileEntry[] = []
      let literals = scope.literals
      node.nodes.forEach((n, i) => {
        const at = child(path, i)
        if (chain >= 0 && i === chain + 1) return
        if (i === chain && n.kind === 'repeat') {
          const ending = node.nodes[i + 1]
          out.push({
            ...base,
            key: at,
            literals,
            kind: 'chain',
            node: n,
            size: 'fill',
            tail:
              ending?.kind === 'choice' ? { node: ending, path: child(path, i + 1) } : undefined,
          })
        } else {
          out.push(...collect(n, at, walk, { ...scope, literals }))
        }
        if (n.kind === 'literal') literals = [...literals, n.token]
      })
      return out
    }

    case 'choice': {
      const labels = node.nodes.map((n, i) => branchLabel(n, i, scope.ui, scope.literals))
      const options = node.optional ? [NO_BRANCH_LABEL, ...labels] : labels
      const picker: TileEntry = {
        ...base,
        kind: 'choice',
        node,
        size: choiceRows(choiceControl(options), options.length),
      }
      const selected = walk.pick(node, path, scope)
      const chosen = selected === NO_BRANCH ? undefined : node.nodes[selected]
      return chosen === undefined
        ? [picker]
        : [picker, ...collect(chosen, branch(path, selected), walk, scope)]
    }

    case 'repeat':
      return [{ ...base, kind: 'chain', node, size: 'fill' }]

    case 'ref': {
      const isAny = node.definitionId === REF_ANY
      const target = isAny ? walk.refTarget(path) : scope.catalogue[node.definitionId]
      const picker: TileEntry[] = isAny ? [{ ...base, kind: 'ref', node, size: 2 }] : []
      if (target === undefined || scope.depth <= 0) return picker
      return [
        ...picker,
        ...collect(target.root, path, walk, {
          ...scope,
          ui: target.ui,
          literals: [],
          depth: scope.depth - 1,
        }),
      ]
    }
  }
}
