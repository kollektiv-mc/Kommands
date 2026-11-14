/**
 * The operation graph a `//generate` shape is built out of.
 *
 * `docs/generate-editor.md` § The decision settles what this is: the editor's document
 * is an operation tree and the command is a projection of it — not a transcript of what
 * the user did, and not a scan of the voxels that came out. This module is that
 * document's vocabulary, and nothing more; `compile.ts` turns it into an expression and
 * `simplify.ts` rewrites it.
 *
 * ## Why a node table rather than nested objects
 *
 * It is a **DAG, not a tree** — a boolean node takes two inputs, so the wiring branches
 * and re-merges, and "one node feeding two consumers" is the case the whole compiler is
 * built around. A nested object graph can express that with a shared reference, and then
 * loses it three ways: `JSON.stringify` duplicates the shared node, so the DAG becomes a
 * tree the first time a command is saved or shared; identity is a `WeakMap` that
 * survives neither serialization nor an immutable update, so nothing can key on it; and
 * a node editor needs stable ids for selection and undo anyway. Issue #33 is the same
 * finding one level down — `/execute`'s clauses break because they are addressed by
 * index — and is not worth repeating here.
 *
 * The cost is that a table is a graph until something checks it, which is what
 * `treeProblems` is for.
 *
 * ## Why primitives are unit-shaped
 *
 * Every primitive sits at the origin and a transform is the only way to move one. That
 * keeps the palette small, and it makes the frame machinery in `compile.ts` load-bearing
 * rather than an optimisation nobody exercises. Sizes stay on the primitives —
 * `sphere(1)` is `x^2+y^2+z^2<1`, and routing that through a scale node would emit
 * `(x/1)^2+…` for no gain.
 */

export type NodeId = string
export type Vec3 = readonly [number, number, number]

/**
 * The axis a shape is oriented along.
 *
 * For a torus it is the axis through the hole; for a cylinder, its length. The two
 * perpendicular coordinates are taken in right-handed cyclic order — `z` pairs `(x, y)`,
 * `x` pairs `(y, z)`, `y` pairs `(z, x)` — so a rotation about an axis turns its pair.
 */
export type Axis = 'x' | 'y' | 'z'

export type CsgNode =
  // ── Primitives, all origin-centred ────────────────────────────────────────
  | { kind: 'sphere'; radius: number }
  | { kind: 'box'; half: Vec3 }
  | { kind: 'torus'; major: number; minor: number; axis: Axis }
  | { kind: 'cylinder'; radius: number; height: number; axis: Axis }
  /** A half-space: everything on the near side of the plane `normal · p = distance`. */
  | { kind: 'plane'; normal: Vec3; distance: number }
  | { kind: 'gyroid'; frequency: number; threshold: number }
  /**
   * The escape hatch: expression source, written by hand.
   *
   * Its `x`, `y` and `z` are substituted by whatever frame it sits in, so it moves with
   * a transform like any other node. Three rules make that sound, and `compile.ts`
   * enforces them: it must be a single expression statement, it must not assign to
   * anything, and it must not call a function that writes back. Without them a raw node
   * could interleave with the compiler's own hoists, and — because every expression
   * statement writes the shared result slot — silently become the result.
   */
  | { kind: 'expression'; source: string }
  /** Never filled. What an unconnected input means, and what absorption rewrites to. */
  | { kind: 'empty' }
  /** Always filled. The complement of `empty`. */
  | { kind: 'universe' }
  // ── Transforms ────────────────────────────────────────────────────────────
  | { kind: 'translate'; child: NodeId; offset: Vec3 }
  | { kind: 'scale'; child: NodeId; factor: Vec3 }
  /** Radians, right-handed about `axis`. */
  | { kind: 'rotate'; child: NodeId; axis: Axis; angle: number }
  /**
   * A general affine map, written out: the child is asked about `M·p + t`.
   *
   * Row-major, three rows of four: `[m00, m01, m02, t0, m10, …, t2]`. It is the inverse
   * of the transform it stands for, the same way `translate` subtracts its offset, and it
   * exists so that a move, a turn and a scale about three axes reach the command as one
   * linear form per coordinate rather than as six nested ones. The caller composes the
   * matrix; this node only says what it means. Its coefficients are data, so whatever
   * rounding the caller chose is part of the shape rather than a liberty the compiler took.
   */
  | { kind: 'affine'; child: NodeId; matrix: Affine }
  // ── Modifiers ─────────────────────────────────────────────────────────────
  // Coordinate maps, like the transforms, but not linear. Each acts at the origin and
  // along an axis, as a primitive sits at the origin: placing one somewhere else, or
  // turning it, is a transform on either side of it. `docs/generate-editor.md` § The
  // layer stack is where they come from: in the editor a modifier acts on every layer
  // below it in its list, and that list is this node's child.
  /** Reflects the child across the plane through the origin normal to `axis`. */
  | { kind: 'mirror'; child: NodeId; axis: Axis; keep: Side }
  /** Pushes the child along `axis` by `amplitude·sin(frequency·along)`. */
  | { kind: 'wave'; child: NodeId; axis: Axis; along: Axis; amplitude: number; frequency: number }
  /** Turns each slice across `axis` by `rate` radians per unit along it, right-handed. */
  | { kind: 'twist'; child: NodeId; axis: Axis; rate: number }
  /** `count` copies of the child, `spacing` apart, from the origin towards +`axis`. */
  | { kind: 'array'; child: NodeId; axis: Axis; spacing: number; count: number }
  /** `count` copies of the child in a circle round `axis`, the first one unturned. */
  | { kind: 'radial'; child: NodeId; axis: Axis; count: number }
  /**
   * Curls a straight guide along `axis` towards `toward`, by `rate` radians per unit of
   * length; a negative rate curls away. `side` bends one half of the guide only, keeping
   * the other straight. Arc length along the guide is preserved, so a bent cylinder
   * keeps its length.
   */
  | { kind: 'bend'; child: NodeId; axis: Axis; toward: Axis; rate: number; side: BendSide }
  /** Scales the cross-section across `axis` by `1 + amount·axis`, narrowing or widening. */
  | { kind: 'taper'; child: NodeId; axis: Axis; amount: number }
  /**
   * Spins the child's outline round `axis`. What is read is the half-plane through the
   * axis and its lower perpendicular coordinate, so for `y` the outline drawn in the
   * x–y plane at z = 0 is turned into a solid of revolution.
   */
  | { kind: 'revolve'; child: NodeId; axis: Axis }
  // ── Combinators ───────────────────────────────────────────────────────────
  | { kind: 'union'; children: readonly NodeId[] }
  | { kind: 'intersect'; children: readonly NodeId[] }
  /**
   * `base` minus every tool. Kept as its own kind rather than sugar for
   * `intersect(base, invert(t))` because the graph should show what was built — the
   * doc's own vocabulary has subtract in it, and a user who drew a subtraction should
   * find one when they come back. The cost is two spellings of one operation, and
   * `simplify.ts` deliberately does not normalise between them.
   */
  | { kind: 'subtract'; base: NodeId; tools: readonly NodeId[] }
  | { kind: 'invert'; child: NodeId }

export type CsgNodeKind = CsgNode['kind']

/** Which half a mirror keeps and reflects into the other. */
export type Side = 'positive' | 'negative'

/** Which half of a bend's guide curls. */
export type BendSide = 'both' | Side

/** `affine`'s matrix: three rows of `[m0, m1, m2, t]`. */
// prettier-ignore
export type Affine = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

/** The identity map, as an `affine` matrix. */
export const IDENTITY_AFFINE: Affine = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]

/** The node kinds that read one child through a changed frame. */
const FRAME_KINDS: ReadonlySet<CsgNodeKind> = new Set([
  'translate',
  'scale',
  'rotate',
  'affine',
  'mirror',
  'wave',
  'twist',
  'array',
  'radial',
  'bend',
  'taper',
  'revolve',
])

/** A node that changes its child's coordinates and does nothing else. */
export type FrameNode = Extract<CsgNode, { child: NodeId }> & {
  kind: Exclude<CsgNodeKind, 'invert'>
}

export const isFrameNode = (node: CsgNode): node is FrameNode => FRAME_KINDS.has(node.kind)

/**
 * A rotation's cosine and sine, exact at the quarter turns.
 *
 * `Math.cos(Math.PI / 2)` is `6.123233995736766e-17`, not zero, so a shape turned a
 * quarter turn would carry a term like that into the command for every axis it touched.
 * A quarter turn is something a person meant exactly, so it is given exactly: within
 * one part in 10^15 of 0 or ±1 is taken as that value. Shared by the compiler and the
 * reference interpreter because it is what a rotation *means*, as `axisFrame` is.
 */
export function turn(angle: number): { cos: number; sin: number } {
  return { cos: snapUnit(Math.cos(angle)), sin: snapUnit(Math.sin(angle)) }
}

const SNAP = 1e-15
function snapUnit(value: number): number {
  if (Math.abs(value) < SNAP) return 0
  if (Math.abs(value - 1) < SNAP) return 1
  if (Math.abs(value + 1) < SNAP) return -1
  return value
}

export interface CsgTree {
  nodes: Readonly<Record<NodeId, CsgNode>>
  root: NodeId
}

/** The empty document: nothing connected, nothing generated. */
export const EMPTY_TREE: CsgTree = { nodes: { n1: { kind: 'empty' } }, root: 'n1' }

/** Every node this one reads, in the order it reads them. */
export function childrenOf(node: CsgNode): readonly NodeId[] {
  switch (node.kind) {
    case 'union':
    case 'intersect':
      return node.children
    case 'subtract':
      return [node.base, ...node.tools]
    case 'invert':
      return [node.child]
    default:
      return isFrameNode(node) ? [node.child] : []
  }
}

/**
 * Build a graph without writing out its ids.
 *
 * Ids come from a counter rather than from `crypto.randomUUID`, because a golden
 * fixture cannot assert against a random name and every diff would be noise.
 */
export function buildTree(build: (add: (node: CsgNode) => NodeId) => NodeId): CsgTree {
  const nodes: Record<NodeId, CsgNode> = {}
  let next = 0
  const add = (node: CsgNode): NodeId => {
    const id = `n${++next}`
    nodes[id] = node
    return id
  }
  const root = build(add)
  return { nodes, root }
}

const isFinite_ = (value: number): boolean => Number.isFinite(value)

/**
 * The structural rules a graph must satisfy, checked against the graph.
 *
 * Strings rather than `Diagnostic`s, and returned rather than thrown, deliberately
 * matching `src/schema/invariants.ts`: a malformed graph is an authoring or editor bug
 * rather than something a user can act on in a form. Nothing here is about whether the
 * shape is *interesting* — only about whether it can be compiled at all.
 *
 * An orphan node — one no path from the root reaches — is **not** a problem. A node
 * editor with nothing wired to a node yet is a normal state, not a broken document.
 */
export function treeProblems(tree: CsgTree): string[] {
  const problems: string[] = []
  const at = (id: NodeId): string => `${id} (${tree.nodes[id]?.kind ?? 'missing'})`

  if (!(tree.root in tree.nodes)) {
    return [`the root ${tree.root} is not in the node table`]
  }

  for (const [id, node] of Object.entries(tree.nodes)) {
    for (const child of childrenOf(node)) {
      if (!(child in tree.nodes)) problems.push(`${at(id)} reads ${child}, which does not exist`)
    }
    problems.push(...parameterProblems(id, node))
  }

  // Depth-first, tracking the current path rather than only what has been seen: a node
  // visited twice is sharing, which is the point of the whole representation, and only a
  // node visited twice *on one path* is a cycle.
  const done = new Set<NodeId>()
  const onPath = new Set<NodeId>()
  const visit = (id: NodeId): void => {
    if (onPath.has(id)) {
      problems.push(`${at(id)} is reachable from itself, so compiling it would not terminate`)
      return
    }
    if (done.has(id) || !(id in tree.nodes)) return
    onPath.add(id)
    for (const child of childrenOf(tree.nodes[id]!)) visit(child)
    onPath.delete(id)
    done.add(id)
  }
  visit(tree.root)

  return problems
}

function parameterProblems(id: NodeId, node: CsgNode): string[] {
  const bad = (what: string): string => `${id} (${node.kind}) has ${what}`
  switch (node.kind) {
    case 'sphere':
      return isFinite_(node.radius) ? [] : [bad('a radius that is not a number')]
    case 'box':
      return node.half.every(isFinite_) ? [] : [bad('a half-extent that is not a number')]
    case 'torus':
      return isFinite_(node.major) && isFinite_(node.minor)
        ? []
        : [bad('a radius that is not a number')]
    case 'cylinder':
      return isFinite_(node.radius) && isFinite_(node.height)
        ? []
        : [bad('a size that is not a number')]
    case 'plane':
      return node.normal.every(isFinite_) && isFinite_(node.distance)
        ? []
        : [bad('a normal or distance that is not a number')]
    case 'gyroid':
      return isFinite_(node.frequency) && isFinite_(node.threshold)
        ? []
        : [bad('a frequency or threshold that is not a number')]
    case 'translate':
      return node.offset.every(isFinite_) ? [] : [bad('an offset that is not a number')]
    case 'scale':
      // Zero is the interesting one: a frame divides by it, so the child would be
      // evaluated at infinity everywhere rather than collapsing to nothing.
      if (!node.factor.every(isFinite_)) return [bad('a factor that is not a number')]
      return node.factor.some((f) => f === 0) ? [bad('a factor of zero, which has no inverse')] : []
    case 'rotate':
      return isFinite_(node.angle) ? [] : [bad('an angle that is not a number')]
    case 'affine':
      return node.matrix.length === 12 && node.matrix.every(isFinite_)
        ? []
        : [bad('a matrix that is not twelve numbers')]
    case 'wave':
      return isFinite_(node.amplitude) && isFinite_(node.frequency)
        ? []
        : [bad('an amplitude or frequency that is not a number')]
    case 'twist':
      return isFinite_(node.rate) ? [] : [bad('a rate that is not a number')]
    case 'array':
      if (!isFinite_(node.spacing) || node.spacing === 0) return [bad('a spacing of zero')]
      return Number.isInteger(node.count) && node.count >= 1
        ? []
        : [bad('a count that is not a whole number of at least one')]
    case 'radial':
      return Number.isInteger(node.count) && node.count >= 1
        ? []
        : [bad('a count that is not a whole number of at least one')]
    case 'bend':
      if (node.axis === node.toward) return [bad('a guide that bends towards itself')]
      return isFinite_(node.rate) ? [] : [bad('a rate that is not a number')]
    case 'taper':
      return isFinite_(node.amount) ? [] : [bad('an amount that is not a number')]
    default:
      return []
  }
}

/**
 * A compact rendering of the graph, for a failing assertion to point at.
 *
 * A node reached more than once prints as `&id` after the first time, so a diamond is
 * visible in the output rather than silently expanded into two copies — which is the
 * bug most worth being able to see.
 */
export function describeTree(tree: CsgTree): string {
  const seen = new Set<NodeId>()
  const render = (id: NodeId): string => {
    const node = tree.nodes[id]
    if (!node) return `<missing ${id}>`
    if (seen.has(id)) return `&${id}`
    seen.add(id)
    const children = childrenOf(node).map(render)
    const params = parametersOf(node)
    const inner = [...params, ...children].join(',')
    return inner === '' ? node.kind : `${node.kind}(${inner})`
  }
  return render(tree.root)
}

function parametersOf(node: CsgNode): string[] {
  switch (node.kind) {
    case 'sphere':
      return [String(node.radius)]
    case 'box':
      return [`[${node.half.join(' ')}]`]
    case 'torus':
      return [String(node.major), String(node.minor), node.axis]
    case 'cylinder':
      return [String(node.radius), String(node.height), node.axis]
    case 'plane':
      return [`[${node.normal.join(' ')}]`, String(node.distance)]
    case 'gyroid':
      return [String(node.frequency), String(node.threshold)]
    case 'expression':
      return [JSON.stringify(node.source)]
    case 'translate':
      return [`[${node.offset.join(' ')}]`]
    case 'scale':
      return [`[${node.factor.join(' ')}]`]
    case 'rotate':
      return [node.axis, String(node.angle)]
    case 'affine':
      return [`[${node.matrix.join(' ')}]`]
    case 'mirror':
      return [node.axis, node.keep]
    case 'wave':
      return [node.axis, node.along, String(node.amplitude), String(node.frequency)]
    case 'twist':
      return [node.axis, String(node.rate)]
    case 'array':
      return [node.axis, String(node.spacing), String(node.count)]
    case 'radial':
      return [node.axis, String(node.count)]
    case 'bend':
      return [node.axis, node.toward, String(node.rate), node.side]
    case 'taper':
      return [node.axis, String(node.amount)]
    case 'revolve':
      return [node.axis]
    default:
      return []
  }
}

/**
 * The two coordinates perpendicular to an axis, and the one along it.
 *
 * Right-handed cyclic order, so a rotation about an axis turns `(u, v)` and leaves `w`.
 * Shared by the compiler and the reference interpreter because getting them out of step
 * would make a torus disagree with itself for a reason neither file would show.
 */
export function axisFrame(axis: Axis): { u: 0 | 1 | 2; v: 0 | 1 | 2; w: 0 | 1 | 2 } {
  switch (axis) {
    case 'z':
      return { u: 0, v: 1, w: 2 }
    case 'x':
      return { u: 1, v: 2, w: 0 }
    case 'y':
      return { u: 2, v: 0, w: 1 }
  }
}

/**
 * The same two coordinates, in coordinate order rather than cyclic order.
 *
 * A torus and a cylinder use their perpendicular pair symmetrically — `u² + v²` — so the
 * cyclic order buys nothing there and costs readability: a torus about `y` would
 * otherwise print `sqrt(z^2+x^2)` where every reference writes `sqrt(x^2+z^2)`. Addition
 * is commutative in IEEE 754, so this is a spelling change and not a numeric one.
 * Rotation still uses `axisFrame`, where the order is the handedness and does matter.
 */
export function perpendicular(axis: Axis): readonly [0 | 1 | 2, 0 | 1 | 2] {
  const { u, v } = axisFrame(axis)
  return u < v ? [u, v] : [v, u]
}
