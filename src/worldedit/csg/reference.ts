import { compileExpression, type CompiledExpression } from '../expression'
import {
  axisFrame,
  perpendicular,
  type CsgNode,
  type CsgTree,
  type NodeId,
  type Vec3,
} from './tree'

/**
 * What a graph means, computed directly.
 *
 * This is the oracle `compile.test.ts` checks the compiler against, and it earns its
 * keep by being a **second implementation rather than a shared one**. It walks the graph
 * per point, applies each transform to the coordinates numerically, and evaluates each
 * primitive as a formula. It knows nothing about frames, about sharing, about hoisting,
 * about printing, or about operator precedence — which is precisely the machinery the
 * compiler has and this does not, and so precisely what a disagreement would be about.
 *
 * A table of specs shared between the two would be tidier and would test nothing.
 *
 * ## Why agreement is exact rather than approximate
 *
 * It mirrors the emitted arithmetic **operator for operator**: `**` where the compiler
 * emits `^`, because `^` compiles to `**` (compile.ts:214); the same left-associative
 * order for a sum of three terms; the same `Math.abs` that `abs` is. `Math.pow(x, 2)`
 * and `x * x` are not required by the language to agree, so the test does not rely on
 * them doing so.
 *
 * That means a mismatch is a real disagreement about the shape and can be asserted
 * bit-exactly, rather than within a tolerance that would hide the boundary errors a CSG
 * compiler actually produces.
 *
 * ## Deliberately slow
 *
 * It recompiles nothing per point but optimises nothing either. It must never be made
 * faster by borrowing anything from `compile.ts`; if it is ever wanted for real work,
 * that is what the compiler and the evaluator are for. Kept out of `index.ts` for the
 * same reason — its only consumers are the differential tests.
 */

/** A predicate over the unit region: true where a block is placed. */
export type ShapePredicate = (x: number, y: number, z: number) => boolean

/**
 * Prepare a graph for evaluation.
 *
 * Raw expression nodes are compiled once here rather than per point, which is the only
 * concession to speed in the file and is not an optimisation — compiling 262,144 times
 * would make the differential test unusable rather than merely slow.
 */
export function referenceFor(tree: CsgTree): ShapePredicate {
  const compiled = new Map<NodeId, CompiledExpression | undefined>()
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.kind !== 'expression') continue
    const result = compileExpression(node.source)
    compiled.set(id, result.ok ? result.expression : undefined)
  }

  const at = (id: NodeId, p: Vec3): boolean => {
    const node = tree.nodes[id]
    if (!node) return false
    return evaluateNode(node, p, id, (child, q) => at(child, q), compiled)
  }

  return (x, y, z) => at(tree.root, [x, y, z])
}

function evaluateNode(
  node: CsgNode,
  p: Vec3,
  id: NodeId,
  at: (child: NodeId, q: Vec3) => boolean,
  compiled: ReadonlyMap<NodeId, CompiledExpression | undefined>,
): boolean {
  const [x, y, z] = p

  switch (node.kind) {
    case 'empty':
      return false
    case 'universe':
      return true

    case 'sphere':
      return x ** 2 + y ** 2 + z ** 2 < node.radius ** 2

    case 'box':
      return Math.abs(x) < node.half[0] && Math.abs(y) < node.half[1] && Math.abs(z) < node.half[2]

    case 'torus': {
      const [u, v] = perpendicular(node.axis)
      const { w } = axisFrame(node.axis)
      const ring = node.major - Math.sqrt(p[u] ** 2 + p[v] ** 2)
      return ring ** 2 + p[w] ** 2 < node.minor ** 2
    }

    case 'cylinder': {
      const [u, v] = perpendicular(node.axis)
      const { w } = axisFrame(node.axis)
      return p[u] ** 2 + p[v] ** 2 < node.radius ** 2 && Math.abs(p[w]) < node.height / 2
    }

    case 'plane':
      return node.normal[0] * x + node.normal[1] * y + node.normal[2] * z < node.distance

    case 'gyroid': {
      const f = node.frequency
      return (
        Math.sin(x * f) * Math.cos(y * f) +
          Math.sin(y * f) * Math.cos(z * f) +
          Math.sin(z * f) * Math.cos(x * f) <
        node.threshold
      )
    }

    case 'expression': {
      // A raw node's body is whatever the user wrote, so it is not a predicate until it
      // is compared. `EditSession.makeShape` places a block where the expression is
      // greater than zero, and that is the comparison — the same one the compiler
      // inserts, for the same reason.
      const expression = compiled.get(id)
      return expression !== undefined && expression.evaluate(x, y, z) > 0
    }

    // Transforms map the *point*, not the shape: to ask whether p is inside a shape that
    // has been moved by d, ask whether p − d is inside the shape that has not.
    case 'translate':
      return at(node.child, [x - node.offset[0], y - node.offset[1], z - node.offset[2]])

    case 'scale':
      return at(node.child, [x / node.factor[0], y / node.factor[1], z / node.factor[2]])

    case 'rotate': {
      const { u, v, w } = axisFrame(node.axis)
      const cos = Math.cos(node.angle)
      const sin = Math.sin(node.angle)
      // Turned by −angle, which is the inverse of turning the shape by +angle.
      const turned: [number, number, number] = [0, 0, 0]
      turned[u] = p[u] * cos + p[v] * sin
      turned[v] = p[u] * -sin + p[v] * cos
      turned[w] = p[w]
      return at(node.child, turned)
    }

    case 'union':
      return node.children.some((child) => at(child, p))

    case 'intersect':
      return node.children.every((child) => at(child, p))

    case 'subtract':
      return at(node.base, p) && !node.tools.some((tool) => at(tool, p))

    case 'invert':
      return !at(node.child, p)
  }
}
