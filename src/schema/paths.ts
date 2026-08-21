import type { Node } from './types'

/**
 * Where a value sits in a definition's tree.
 *
 * Values are keyed by *path*, not by argument name, and that is deliberate. A node
 * under a Repeat appears many times at runtime, so two clauses of
 * `/execute as @a as @p` would collide on `as_targets` if names were keys.
 *
 * Names are how a *rule* — a constraint, a preview input — addresses an argument, and
 * that is a different question with a different answer: see `addressing.ts`. This
 * module answers "where is this value right now"; that one answers "which node does
 * this name mean". Conflating them is what let a name that matched 36 nodes look
 * exactly like a clause the user had repeated 36 times.
 */
export type Path = string

export const ROOT: Path = ''

export const child = (parent: Path, index: number): Path => `${parent}/${index}`
export const instance = (parent: Path, index: number): Path => `${parent}/#${index}`
export const branch = (parent: Path, index: number): Path => `${parent}/|${index}`

/**
 * Rewrite every key beneath a Repeat so its instances land in a new order.
 *
 * An instance path carries its index — `/1/#0` — so moving or dropping a clause is
 * never a change to one key. Every value, choice, flag, nested repeat count and ref
 * below it is keyed through that index and has to move with it.
 *
 * `order[i]` is the index the instance now at position `i` held before. An index
 * absent from `order` is dropped, which is what removal is: the alternative, leaving
 * the keys in place, is what made a removed clause's values reappear in the next one
 * added.
 */
export function reindexInstances<T>(
  table: Readonly<Record<Path, T>>,
  repeatPath: Path,
  order: readonly number[],
): Record<Path, T> {
  const prefix = `${repeatPath}/#`
  const next: Record<Path, T> = {}
  for (const [key, held] of Object.entries(table)) {
    if (!key.startsWith(prefix)) {
      next[key] = held
      continue
    }
    // Read the whole index, not one character: `#1` and `#10` share a prefix, and
    // truncating would fold the eleventh clause into the second.
    const rest = key.slice(prefix.length)
    const end = rest.indexOf('/')
    const digits = end === -1 ? rest : rest.slice(0, end)
    const was = Number(digits)
    const now = order.indexOf(was)
    if (!/^\d+$/.test(digits) || now === -1) continue
    next[`${prefix}${now}${end === -1 ? '' : rest.slice(end)}`] = held
  }
  return next
}

/**
 * Every key at or below `path` removed.
 *
 * The subtree guard, and the counterpart of the one CommandWorkbench applies when the
 * whole command changes. Its reasoning holds one level down too: a path means nothing
 * outside the definition it was built against, and a Ref's subtree *is* another
 * definition. Leaving `/give`'s item where `/particle` reads a position does not
 * produce a wrong command, it produces no command — the serializer is handed a value
 * of a shape its type never makes, and throws, taking the output panel with it.
 */
export function clearSubtree<T>(table: Readonly<Record<Path, T>>, path: Path): Record<Path, T> {
  const next: Record<Path, T> = {}
  for (const [key, held] of Object.entries(table)) {
    if (key === path || key.startsWith(`${path}/`)) continue
    next[key] = held
  }
  return next
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
 * Descend each Repeat exactly once, whatever the user has actually added.
 *
 * "How many clauses exist right now" is a fact about a value; "which node does this
 * name mean" is a fact about the definition. `addressing.ts` asks the second and must
 * not get a different answer on an empty form than on a filled one.
 */
export const STATIC = 'static' as const

/**
 * Visit every live node, honouring repeat counts but *not* choice selections.
 *
 * Not choices, because callers of this are resolving names for constraints and
 * previews, and a constraint has to see an argument that is currently on an unselected
 * branch — otherwise selecting a branch would silently change which rules apply.
 *
 * `literals` is the enclosing literal chain, outermost first, and it is what makes a
 * duplicated name addressable: `/execute`'s 36 arguments called `scale` differ only by
 * the keywords above them. A literal contributes to its *later siblings* and to
 * nothing else — it is not in scope for itself, for its parent, or for a sibling
 * before it, because those are tokens the user types earlier in the command.
 */
export function walk(
  node: Node,
  path: Path,
  counts: RepeatCounts | typeof STATIC,
  visit: (node: Node, path: Path, literals: readonly string[]) => void,
  literals: readonly string[] = [],
): void {
  visit(node, path, literals)
  switch (node.kind) {
    case 'sequence': {
      let chain = literals
      node.nodes.forEach((n, i) => {
        walk(n, child(path, i), counts, visit, chain)
        if (n.kind === 'literal') chain = [...chain, n.token]
      })
      break
    }

    // Branches are alternatives, so each inherits the same chain rather than each
    // other's — a keyword on one branch is not above an argument on the next.
    case 'choice':
      node.nodes.forEach((n, i) => walk(n, branch(path, i), counts, visit, literals))
      break

    case 'repeat': {
      const n = counts === STATIC ? 1 : repeatCount(counts, path, node)
      for (let i = 0; i < n; i++) walk(node.node, instance(path, i), counts, visit, literals)
      break
    }

    // The remaining kinds are spelled out rather than left to a `default`, so adding a
    // node kind is a compile error here too — the same reason CommandRenderer's walk
    // is exhaustive.
    case 'literal':
    case 'argument':
      // Leaves. `optional` and `variadic` are fields, not children.
      break

    case 'flagset':
      // Its flags are not Nodes — they have no `kind`, and they key into
      // `CommandValue.flags` rather than `.args`. `addressing.ts` expands them, which
      // keeps this walk over one kind of thing.
      break

    case 'ref':
      // Deliberately does not descend. A Ref's subtree *is* another definition, with
      // its own names and its own path space — the same reasoning `clearSubtree`
      // states above. The consequence worth naming: a constraint or a preview input
      // cannot reach across a Ref. Wanting that is cross-definition constraints, a
      // different feature, not a wider selector.
      break
  }
}
