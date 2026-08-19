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

/**
 * Which branch each Choice has selected.
 *
 * Absent does not mean the same thing for every Choice, which is the point of
 * `choiceSelection` rather than a bare lookup: a required Choice must apply one of its
 * branches, so absent means the first; an optional one may apply none, and that is the
 * state a fresh command starts in.
 */
export type ChoiceSelections = Readonly<Record<Path, number>>

/** No branch of an optional Choice applies. */
export const NO_BRANCH = -1

export function repeatCount(counts: RepeatCounts, path: Path, node: { min?: number }): number {
  return counts[path] ?? node.min ?? 0
}

/**
 * Which branch of a Choice applies, or NO_BRANCH.
 *
 * An out-of-range selection resolves the same way an absent one does. Selections are
 * keyed by path and definitions are data, so a stored index can outlive the branch it
 * pointed at — switching a Ref's target, or regenerating a skeleton with fewer
 * branches, both leave one behind.
 */
export function choiceSelection(
  selections: ChoiceSelections,
  path: Path,
  node: { nodes: unknown[]; optional?: boolean },
): number {
  const fallback = node.optional ? NO_BRANCH : 0
  const selected = selections[path] ?? fallback
  if (selected === NO_BRANCH) return node.optional ? NO_BRANCH : 0
  return selected >= 0 && selected < node.nodes.length ? selected : fallback
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
