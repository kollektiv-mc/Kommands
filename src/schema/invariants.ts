import type { CommandDefinition, Node } from './types'

/**
 * The structural rules a definition must satisfy, checked against the definition.
 *
 * Definitions are data, and this repo has two ways of producing them — a generator
 * reading mcmeta, and a person writing a file — so "the type checks" is not the same
 * as "the tree makes sense". These are the rules `docs/command-schema.md` § Invariants
 * states that TypeScript cannot: they are about where a node sits, not what shape it
 * has.
 *
 * Returned as strings rather than thrown, and rather than `Diagnostic`s: a broken
 * definition is an authoring mistake, not something a user can act on in the form. The
 * test suite runs this over the whole catalogue, which is where it should fail.
 */
export function definitionProblems(definition: CommandDefinition): string[] {
  return variadicProblems(definition.root, false).map((problem) => `${definition.id}: ${problem}`)
}

/**
 * Invariant 6 — nothing may follow a variadic argument.
 *
 * A variadic argument consumes every remaining token, so a node after it is not merely
 * unlikely to be reached, it is unreachable: whatever the user types into it has
 * already been eaten by the expression above. The form would draw a field that cannot
 * affect the command, which is the quietest kind of wrong.
 *
 * `follows` is whether anything can be emitted after the node being checked.
 */
function variadicProblems(node: Node, follows: boolean): string[] {
  switch (node.kind) {
    case 'argument':
      return node.variadic && follows
        ? [`the variadic argument "${node.name}" has nodes after it, which can never be reached`]
        : []

    case 'sequence':
      return node.nodes.flatMap((child, i) =>
        // A later sibling counts as following even when it is optional: the definition
        // permits it, and optionality is the user's choice rather than the tree's shape.
        variadicProblems(child, follows || i < node.nodes.length - 1),
      )

    // Branches are alternatives, so each inherits the same tail rather than each other.
    case 'choice':
      return node.nodes.flatMap((child) => variadicProblems(child, follows))

    // Always followed — by the next instance of itself.
    case 'repeat':
      return variadicProblems(node.node, true)

    // A Ref's target is another definition, checked on its own. What matters here is
    // that a variadic *before* a Ref is caught by the sequence rule above.
    default:
      return []
  }
}
