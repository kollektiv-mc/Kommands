import { selectorNames } from './addressing'
import type { Node, UiMetadata } from './types'

/**
 * How the form names and draws the parts of a definition. Pure, so the rules are
 * tested directly rather than through rendered markup, and shared by everything that
 * has to agree on them.
 *
 * Nothing here knows which command it is looking at. It reads the node's shape and the
 * authored metadata it is handed, the same as the renderer.
 */

type ArgumentNode = Extract<Node, { kind: 'argument' }>
type ChoiceNode = Extract<Node, { kind: 'choice' }>

/**
 * The authored presentation of an argument, found by selector.
 *
 * `ui.arguments` used to be read by the bare Brigadier name, which cannot tell apart the
 * 36 arguments `/execute` calls `scale`. A key is now a selector, exactly as a constraint
 * target is (`result/block/byte/scale`), and a bare name remains the common case. The
 * first key that names this node wins, so a more specific entry is written first.
 */
export function argumentPresentation(
  ui: UiMetadata | undefined,
  node: ArgumentNode,
  literals: readonly string[],
): { label?: string; help?: string } | undefined {
  const entries = ui?.arguments
  if (!entries) return undefined
  const exact = entries[node.name]
  if (exact) return exact
  for (const [selector, entry] of Object.entries(entries)) {
    if (selectorNames(selector, node.name, literals)) return entry
  }
  return undefined
}

/**
 * What a branch of a Choice is called in its picker.
 *
 * A keyword-led branch is called by its keyword, which is the command's own word for
 * it. A branch that starts with an argument used to be "option 2", which named nothing;
 * it is now called by that argument's label, so `/effect give`'s duration reads
 * `infinite` or `seconds`.
 */
export function branchLabel(
  node: Node,
  index: number,
  ui?: UiMetadata,
  literals: readonly string[] = [],
): string {
  if (node.kind === 'literal') return node.token
  const first = node.kind === 'sequence' ? node.nodes[0] : node
  if (first?.kind === 'literal') return first.token
  if (first?.kind === 'argument') {
    return argumentPresentation(ui, first, literals)?.label?.toLowerCase() ?? first.name
  }
  return `option ${index + 1}`
}

/** What the label of a Choice's row says, when nothing authored says otherwise. */
export function choiceLabel(node: ChoiceNode, inClause: boolean): string {
  if (inClause) return 'Clause'
  if (node.optional) return 'Continue with'
  const keywordLed = node.nodes.every(
    (n) => n.kind === 'literal' || (n.kind === 'sequence' && n.nodes[0]?.kind === 'literal'),
  )
  return keywordLed ? 'Action' : 'Form'
}

/** What an optional Choice with nothing selected is called among its branches. */
export const NO_BRANCH_LABEL = 'none'

/**
 * Whether a Choice's branches fit side by side as a segmented control, or need a list.
 *
 * Side by side when they are few and short, because then every option is visible and
 * one click away, and a change of mind is another click rather than reopening a list.
 * `/execute`'s thirteen clauses, or `on`'s eight relations, would not fit a row and
 * go in a list.
 */
export function choiceControl(labels: readonly string[]): 'segmented' | 'listbox' {
  return labels.length <= 5 && labels.every((label) => label.length <= 12) ? 'segmented' : 'listbox'
}

/**
 * Which control a closed set of values gets (`EnumEditor`). Decided once per type, at
 * registration, because the row labels the two differently: a listbox is one control
 * its label points at, a segmented control is a group of radios its label names.
 * Counted with the Default segment, so an optional argument never tips a set over
 * into the other control.
 */
export const enumControl = (values: readonly string[]) => choiceControl(['Default', ...values])

/**
 * Where a chain's last step is: the index of a Repeat whose next sibling is an
 * optional Choice of one branch, or -1. That is `/execute`'s shape, `(clause)* [run
 * <command>]`, and it is found by shape rather than by command id so the renderer
 * still never branches on which command it is drawing. The Choice is then drawn as
 * the chain's final step instead of as a row after it, where it sat outside the chain
 * it ends.
 */
export function chainTail(nodes: readonly Node[]): number {
  return nodes.findIndex((node, i) => {
    const next = nodes[i + 1]
    return (
      node.kind === 'repeat' &&
      next?.kind === 'choice' &&
      next.optional === true &&
      next.nodes.length === 1
    )
  })
}
