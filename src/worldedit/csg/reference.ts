import { compileExpression, type CompiledExpression } from '../expression'
import {
  axisFrame,
  perpendicular,
  turn,
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
      const { cos, sin } = turn(node.angle)
      // Turned by −angle, which is the inverse of turning the shape by +angle.
      const turned: [number, number, number] = [0, 0, 0]
      turned[u] = p[u] * cos + p[v] * sin
      turned[v] = p[u] * -sin + p[v] * cos
      turned[w] = p[w]
      return at(node.child, turned)
    }

    case 'affine': {
      const m = node.matrix
      const row = (r: number): number =>
        x * m[r * 4]! + y * m[r * 4 + 1]! + z * m[r * 4 + 2]! + m[r * 4 + 3]!
      return at(node.child, [row(0), row(1), row(2)])
    }

    // ── Modifiers, each written out as the map it is named for ──────────────
    case 'mirror': {
      const i = INDEX[node.axis]
      const folded = Math.abs(p[i])
      return at(node.child, put(p, [[i, node.keep === 'positive' ? folded : -folded]]))
    }

    case 'wave': {
      const i = INDEX[node.axis]
      const pushed = p[i] - node.amplitude * Math.sin(p[INDEX[node.along]] * node.frequency)
      return at(node.child, put(p, [[i, pushed]]))
    }

    case 'twist': {
      if (node.rate === 0) return at(node.child, p)
      const { u, v, w } = axisFrame(node.axis)
      const angle = p[w] * node.rate
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      return at(
        node.child,
        put(p, [
          [u, p[u] * cos + p[v] * sin],
          [v, p[v] * cos - p[u] * sin],
        ]),
      )
    }

    case 'array': {
      if (node.count <= 1) return at(node.child, p)
      const i = INDEX[node.axis]
      const copy = Math.min(Math.max(Math.round(p[i] / node.spacing), 0), node.count - 1)
      return at(node.child, put(p, [[i, p[i] - node.spacing * copy]]))
    }

    case 'radial': {
      if (node.count <= 1) return at(node.child, p)
      const [a, b] = perpendicular(node.axis)
      const sector = (2 * Math.PI) / node.count
      const angle = Math.atan2(p[b], p[a])
      const local = angle - sector * Math.round(angle / sector)
      const radius = Math.sqrt(p[a] ** 2 + p[b] ** 2)
      return at(
        node.child,
        put(p, [
          [a, radius * Math.cos(local)],
          [b, radius * Math.sin(local)],
        ]),
      )
    }

    case 'bend': {
      if (node.rate === 0) return at(node.child, p)
      const s = INDEX[node.axis]
      const u = INDEX[node.toward]
      const towards = node.rate > 0
      const radius = 1 / Math.abs(node.rate)
      const gap = radius - (towards ? p[u] : -p[u])
      const along =
        node.side === 'both'
          ? p[s]
          : node.side === 'positive'
            ? Math.max(p[s], 0)
            : Math.min(p[s], 0)
      const arc = radius * Math.atan2(along, gap)
      const straight =
        node.side === 'both' ? 0 : node.side === 'positive' ? Math.min(p[s], 0) : Math.max(p[s], 0)
      const off = radius - Math.sqrt(along ** 2 + gap ** 2)
      return at(
        node.child,
        put(p, [
          [s, node.side === 'both' ? arc : straight + arc],
          [u, towards ? off : -off],
        ]),
      )
    }

    case 'taper': {
      if (node.amount === 0) return at(node.child, p)
      const [a, b] = perpendicular(node.axis)
      const along = p[INDEX[node.axis]]
      const width = node.amount < 0 ? 1 - -node.amount * along : 1 + node.amount * along
      return at(
        node.child,
        put(p, [
          [a, p[a] / width],
          [b, p[b] / width],
        ]),
      )
    }

    case 'revolve': {
      const [a, b] = perpendicular(node.axis)
      return at(
        node.child,
        put(p, [
          [a, Math.sqrt(p[a] ** 2 + p[b] ** 2)],
          [b, 0],
        ]),
      )
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

const INDEX = { x: 0, y: 1, z: 2 } as const

/** A copy of `p` with some coordinates replaced. */
function put(p: Vec3, changes: ReadonlyArray<readonly [0 | 1 | 2, number]>): Vec3 {
  const next: [number, number, number] = [p[0], p[1], p[2]]
  for (const [i, value] of changes) next[i] = value
  return next
}
