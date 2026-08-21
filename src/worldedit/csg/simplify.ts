import { childrenOf, type CsgNode, type CsgTree, type NodeId, type Vec3 } from './tree'

/**
 * The graph, tidied, without changing what it means.
 *
 * `docs/generate-editor.md` names this as one of the two properties that fall out of
 * choosing an operation tree over a transcript: **simplification is a pure function on
 * the tree**, testable without a canvas and without a browser. So it is a function the
 * caller applies, not a flag on `compileTree` — hiding it inside the compiler would make
 * the thing that is supposed to be independently testable depend on the compiler.
 *
 * Every rule here is sound only because a node's value is normalised to 0 or 1 before it
 * reaches a combinator. Flattening `union(a, union(b, c))` and collapsing
 * `invert(invert(a))` are both false over arbitrary numbers, where `&&` and `||` return
 * an operand rather than a boolean — see `compile.ts` § Predicates.
 *
 * Nothing here is an optimiser. It removes what an editor produces by ordinary use — a
 * transform dragged back to zero, a union built one node at a time — and stops there.
 * Deliberately absent: folding a scale into a translate, or two rotations about
 * different axes, both of which need a general affine node and so are a change to the
 * vocabulary rather than a rewrite; and de-duplicating structurally identical siblings,
 * which needs an answer to "which node id survives" that only an editor can give. The
 * compiler already collapses the *emitted text* of a duplicate, so deferring that costs
 * nothing in the command and only leaves the graph looking redundant.
 *
 * **Ids are not preserved.** The result is a fresh table, because flattening and
 * absorption produce nodes that did not exist and drop nodes that did. Sharing *is*
 * preserved: a node reached twice is rewritten once and stays one node.
 */

const nonPositive = (values: readonly number[]): boolean => values.some((v) => v <= 0)

export function simplify(tree: CsgTree): CsgTree {
  const nodes: Record<NodeId, CsgNode> = {}
  let counter = 0

  const add = (node: CsgNode): NodeId => {
    let id: NodeId
    do id = `n${++counter}`
    while (id in nodes)
    nodes[id] = node
    return id
  }

  // One `empty` and one `universe` for the whole graph, so absorption does not litter
  // the table with copies of a node that carries nothing.
  let emptyId: NodeId | undefined
  let universeId: NodeId | undefined
  const empty = (): NodeId => (emptyId ??= add({ kind: 'empty' }))
  const universe = (): NodeId => (universeId ??= add({ kind: 'universe' }))

  const kindOf = (id: NodeId): CsgNode['kind'] | undefined => nodes[id]?.kind
  const at = (id: NodeId): CsgNode | undefined => nodes[id]

  const memo = new Map<NodeId, NodeId>()
  const go = (id: NodeId): NodeId => {
    const held = memo.get(id)
    if (held !== undefined) return held
    const node = tree.nodes[id]
    const result = node === undefined ? empty() : rewrite(node)
    memo.set(id, result)
    return result
  }

  /** Returns an id rather than a node, so an unchanged subgraph keeps being one node. */
  function rewrite(node: CsgNode): NodeId {
    switch (node.kind) {
      // Degenerate primitives are nothing, and saying so is what lets absorption reach
      // them: a union with a zero-radius sphere in it should lose the sphere, not carry
      // an expression that is false everywhere.
      case 'sphere':
        return nonPositive([node.radius]) ? empty() : add(node)
      case 'box':
        return nonPositive(node.half) ? empty() : add(node)
      case 'torus':
        return nonPositive([node.minor]) ? empty() : add(node)
      case 'cylinder':
        return nonPositive([node.radius, node.height]) ? empty() : add(node)

      case 'translate':
      case 'scale':
      case 'rotate': {
        const child = go(node.child)

        // Exact zero and exact one only. A nearly-zero angle is a choice someone made,
        // and an epsilon here would make the command differ from the graph on screen.
        const identity =
          (node.kind === 'translate' && node.offset.every((v) => v === 0)) ||
          (node.kind === 'scale' && node.factor.every((v) => v === 1)) ||
          (node.kind === 'rotate' && node.angle === 0)
        if (identity) return child

        // Nothing and everything are unmoved by anything.
        const inner = at(child)
        if (inner?.kind === 'empty' || inner?.kind === 'universe') return child

        const folded = compose(node, inner)
        return add(folded ?? { ...node, child })
      }

      case 'union':
      case 'intersect': {
        // Flatten first, so `union(a, union(b, c))` — which is what building a union one
        // node at a time produces — absorbs as one list rather than two.
        const children = node.children.flatMap((id) => {
          const rewritten = go(id)
          const child = at(rewritten)
          return child?.kind === node.kind ? [...child.children] : [rewritten]
        })

        const absorbing = node.kind === 'union' ? 'universe' : 'empty'
        const neutral = node.kind === 'union' ? 'empty' : 'universe'
        if (children.some((id) => kindOf(id) === absorbing)) {
          return absorbing === 'universe' ? universe() : empty()
        }

        const kept = children.filter((id) => kindOf(id) !== neutral)
        if (kept.length === 0) return neutral === 'empty' ? empty() : universe()
        if (kept.length === 1) return kept[0]!
        return add({ ...node, children: kept })
      }

      case 'subtract': {
        const base = go(node.base)
        if (kindOf(base) === 'empty') return empty()
        const tools = node.tools.map(go)
        if (tools.some((id) => kindOf(id) === 'universe')) return empty()
        const kept = tools.filter((id) => kindOf(id) !== 'empty')
        return kept.length === 0 ? base : add({ kind: 'subtract', base, tools: kept })
      }

      case 'invert': {
        const child = go(node.child)
        const inner = at(child)
        if (inner?.kind === 'empty') return universe()
        if (inner?.kind === 'universe') return empty()
        // Sound only over 0/1, which the compiler guarantees at every boundary.
        if (inner?.kind === 'invert') return inner.child
        return add({ kind: 'invert', child })
      }

      case 'empty':
        return empty()
      case 'universe':
        return universe()

      default:
        return add(node)
    }
  }

  return prune({ nodes, root: go(tree.root) })
}

/**
 * Two transforms of the same kind, written as one.
 *
 * Only the same kind, and for rotation only the same axis. Anything else needs a general
 * affine node, which is a change to the vocabulary and therefore to the editor.
 */
function compose(
  outer: CsgNode & { kind: 'translate' | 'scale' | 'rotate' },
  inner: CsgNode | undefined,
): CsgNode | undefined {
  if (outer.kind === 'translate' && inner?.kind === 'translate') {
    return { kind: 'translate', child: inner.child, offset: zip(outer.offset, inner.offset, sum) }
  }
  if (outer.kind === 'scale' && inner?.kind === 'scale') {
    return { kind: 'scale', child: inner.child, factor: zip(outer.factor, inner.factor, product) }
  }
  if (outer.kind === 'rotate' && inner?.kind === 'rotate' && outer.axis === inner.axis) {
    return {
      kind: 'rotate',
      child: inner.child,
      axis: outer.axis,
      angle: outer.angle + inner.angle,
    }
  }
  return undefined
}

const sum = (a: number, b: number): number => a + b
const product = (a: number, b: number): number => a * b
const zip = (a: Vec3, b: Vec3, f: (x: number, y: number) => number): Vec3 => [
  f(a[0], b[0]),
  f(a[1], b[1]),
  f(a[2], b[2]),
]

/**
 * Everything the root no longer reaches, dropped.
 *
 * Rewriting leaves intermediates behind — the pre-flattening union, the transform that
 * folded into its child. This is the one place an orphan *is* removed, because it is one
 * this function created rather than one a user left unwired.
 */
function prune(tree: CsgTree): CsgTree {
  const kept: Record<NodeId, CsgNode> = {}
  const visit = (id: NodeId): void => {
    if (id in kept) return
    const node = tree.nodes[id]
    if (!node) return
    kept[id] = node
    for (const child of childrenOf(node)) visit(child)
  }
  visit(tree.root)
  return { nodes: kept, root: tree.root }
}
