import type { Node } from './types'

/**
 * Where a value sits in a definition's tree.
 *
 * Values are keyed by *path*, not by argument name, and that is deliberate.
 * docs/command-schema.md says a name is unique within a definition, which is true of
 * the definition — but a node under a Repeat appears many times at runtime. Two
 * clauses of `/execute as @a as @p` would collide on `as_targets` if names were keys.
 *
 * The name is still how constraints and preview inputs address an argument; see
 * `pathsForName`, which resolves a name to every path it currently occupies.
 */
export type Path = string

export const ROOT: Path = ''

export const child = (parent: Path, index: number): Path => `${parent}/${index}`
export const instance = (parent: Path, index: number): Path => `${parent}/#${index}`
export const branch = (parent: Path, index: number): Path => `${parent}/|${index}`

/** Every path at which an argument called `name` currently sits. */
export function pathsForName(root: Node, name: string, counts: RepeatCounts): Path[] {
  const found: Path[] = []
  walk(root, ROOT, counts, (node, path) => {
    if (node.kind === 'argument' && node.name === name) found.push(path)
  })
  return found
}

/** How many instances each Repeat currently has. Absent means `min`, or zero. */
export type RepeatCounts = Readonly<Record<Path, number>>

/** Which branch each Choice has selected. Absent means the first. */
export type ChoiceSelections = Readonly<Record<Path, number>>

export function repeatCount(counts: RepeatCounts, path: Path, node: { min?: number }): number {
  return counts[path] ?? node.min ?? 0
}

/**
 * Visit every live node, honouring repeat counts but *not* choice selections.
 *
 * Not choices, because callers of this are resolving names for constraints and
 * previews, and a constraint has to see an argument that is currently on an unselected
 * branch — otherwise selecting a branch would silently change which rules apply.
 */
export function walk(
  node: Node,
  path: Path,
  counts: RepeatCounts,
  visit: (node: Node, path: Path) => void,
): void {
  visit(node, path)
  switch (node.kind) {
    case 'sequence':
      node.nodes.forEach((n, i) => walk(n, child(path, i), counts, visit))
      break
    case 'choice':
      node.nodes.forEach((n, i) => walk(n, branch(path, i), counts, visit))
      break
    case 'repeat': {
      const n = repeatCount(counts, path, node)
      for (let i = 0; i < n; i++) walk(node.node, instance(path, i), counts, visit)
      break
    }
    default:
      break
  }
}
