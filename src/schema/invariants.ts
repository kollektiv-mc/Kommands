import { qualify, resolveTarget } from './addressing'
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
  return [...variadicProblems(definition.root, false), ...addressingProblems(definition)].map(
    (problem) => `${definition.id}: ${problem}`,
  )
}

/**
 * Invariant 7 — a name a rule addresses must mean exactly one node.
 *
 * Not "every argument name is unique", which was the old claim and was never true of a
 * derived skeleton: those carry Brigadier's own names, and Brigadier addresses nodes by
 * position, so it never had a reason to make them unique. 33 of 78 definitions have a
 * duplicate. What matters is narrower and checkable — a name nothing addresses can
 * collide freely, and a name something addresses must not.
 *
 * This is also the build-time validation `docs/adding-a-preview.md` requires of preview
 * `inputs`, and the reason it can be written now: it does not depend on derived names
 * being unique, only on the ones actually pointed at.
 *
 * The diagnostic carries a working replacement rather than only a complaint, because a
 * check that leaves the author to work out the fix is a check they route around.
 */
function addressingProblems(definition: CommandDefinition): string[] {
  const addressed = [
    ...(definition.constraints ?? []).flatMap((constraint) =>
      constraint.targets.map((selector) => ({ where: `the ${constraint.kind}`, selector })),
    ),
    ...(definition.preview?.inputs ?? []).map((selector) => ({
      where: 'the preview',
      selector,
    })),
  ]

  return addressed.flatMap(({ where, selector }) => {
    const [first, ...rest] = resolveTarget(definition.root, selector)
    if (first === undefined) {
      return [`${where} names "${selector}", which is not an argument or a flag here`]
    }
    if (rest.length === 0) return []

    // Two commands have collisions no keyword separates — /loot and /teleport, where
    // Brigadier tells the nodes apart by position alone. Saying so is more use than
    // suggesting the name back unchanged.
    const suggestion = qualify(definition.root, first)
    const advice =
      suggestion === selector
        ? ', and no enclosing keyword tells them apart'
        : `. Qualify it, as in "${suggestion}"`
    return [`${where} names "${selector}", which matches ${rest.length + 1} nodes${advice}`]
  })
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
