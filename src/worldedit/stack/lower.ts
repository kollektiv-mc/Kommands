import { EMPTY_TREE, buildTree, type CsgNode, type CsgTree, type NodeId } from '../csg'
import { isMoved, isScaled, isTurned, placement, placementInverse, tidy } from './affine'
import {
  actsBelow,
  type AxisName,
  type GroupLayer,
  type Layer,
  type ModifierLayer,
  type Op,
  type ShapeLayer,
  type Vec3,
} from './layers'

/**
 * The layer stack as a `CsgTree`.
 *
 * Each list is read top to bottom. A shape combines with everything above it: Add unions,
 * Cut subtracts, Overlap intersects, and a Cut or Overlap with nothing above it does
 * nothing. A modifier and a Half act on every shape below them in their list. Warping
 * each shape below and warping the union of a run of same-op shapes are the same thing,
 * so each run is built once and wrapped once: the first modifier outermost, the way the
 * list reads.
 *
 * A group is a list of its own and one layer to its parent. A group that is moved,
 * turned or scaled keeps only what lies inside its own −1..1 box, which is what the
 * selection showed before it was moved.
 *
 * Scale is folded into a primitive's own size wherever its formula allows, so a sphere
 * grown with the gizmo stays `x^2+y^2+z^2<r^2` rather than gaining a scale frame.
 */

type Add = (node: CsgNode) => NodeId

export function lowerLayers(layers: readonly Layer[]): CsgTree {
  let empty = false
  const tree = buildTree((add) => {
    const root = stack(layers, add)
    if (root !== null) return root
    empty = true
    return add({ kind: 'empty' })
  })
  return empty ? EMPTY_TREE : tree
}

const COMBINATOR = { add: 'union', cut: 'subtract', overlap: 'intersect' } as const

/** What the list has built so far, with the last combinator still open to more of its kind. */
class Accumulator {
  private base: NodeId | null = null
  private open: { op: Op; ids: NodeId[] } | null = null

  constructor(private readonly add: Add) {}

  combine(op: Op, id: NodeId): void {
    if (this.base === null) {
      if (op === 'add') this.base = id
      return
    }
    if (this.open?.op === op) {
      this.open.ids.push(id)
      return
    }
    this.base = this.result()
    this.open = { op, ids: [id] }
  }

  result(): NodeId | null {
    const { base, open } = this
    if (base === null || open === null) return base
    this.open = null
    const kind = COMBINATOR[open.op]
    this.base =
      kind === 'subtract'
        ? this.add({ kind, base, tools: open.ids })
        : this.add({ kind, children: [base, ...open.ids] })
    return this.base
  }
}

function stack(layers: readonly Layer[], add: Add): NodeId | null {
  const acc = new Accumulator(add)
  const wraps: Array<(id: NodeId) => NodeId> = []
  let run: { op: Op; ids: NodeId[] } | null = null

  const flush = (): void => {
    if (run === null) return
    let id =
      run.ids.length === 1
        ? run.ids[0]!
        : add({ kind: run.op === 'overlap' ? 'intersect' : 'union', children: run.ids })
    for (let i = wraps.length - 1; i >= 0; i--) id = wraps[i]!(id)
    acc.combine(run.op, id)
    run = null
  }

  for (const layer of layers) {
    if (!layer.visible || layer.type === 'reference') continue
    if (actsBelow(layer)) {
      flush()
      wraps.push(wrapper(layer, add))
      continue
    }
    const id = layer.type === 'group' ? groupNode(layer, add) : shapeNode(layer, add)
    if (id === null) continue
    if (wraps.length === 0) {
      acc.combine(layer.op, id)
      continue
    }
    if (run !== null && run.op !== layer.op) flush()
    run ??= { op: layer.op, ids: [] }
    run.ids.push(id)
  }
  flush()
  return acc.result()
}

/** What a modifier or a Half does to each run below it. */
function wrapper(layer: ModifierLayer | ShapeLayer, add: Add): (id: NodeId) => NodeId {
  if (layer.type === 'modifier') return (id) => modifierNode(layer, id, add)
  return (id) => {
    const half = shapeNode(layer, add)!
    if (layer.op === 'cut') return add({ kind: 'subtract', base: id, tools: [half] })
    return add({ kind: layer.op === 'overlap' ? 'intersect' : 'union', children: [id, half] })
  }
}

function groupNode(layer: GroupLayer, add: Add): NodeId | null {
  let id = stack(layer.children, add)
  if (id === null) return null
  if (isMoved(layer.pos) || isTurned(layer.rot) || isScaled(layer.scl)) {
    id = add({ kind: 'intersect', children: [id, add({ kind: 'box', half: [1, 1, 1] })] })
  }
  return placed(id, layer.pos, layer.rot, layer.scl, add)
}

/** A child put at `pos`, turned by `rot` and scaled by `scl`, with as few nodes as that takes. */
function placed(id: NodeId, pos: Vec3, rot: Vec3, scl: Vec3, add: Add): NodeId {
  if (isTurned(rot))
    return add({ kind: 'affine', child: id, matrix: placementInverse(pos, rot, scl) })
  let out = id
  if (isScaled(scl)) out = add({ kind: 'scale', child: out, factor: scl })
  if (isMoved(pos)) out = add({ kind: 'translate', child: out, offset: pos })
  return out
}

const UNIT: Vec3 = [1, 1, 1]
const ORIGIN: Vec3 = [0, 0, 0]

/** A shape's primitive with whatever scale its formula can take folded in, then placed. */
function shapeNode(layer: ShapeLayer, add: Add): NodeId {
  const { id, folded, turnFree } = primitive(layer, add)
  const scl = folded ? UNIT : layer.scl
  return placed(id, layer.pos, turnFree ? ORIGIN : layer.rot, scl, add)
}

interface Primitive {
  id: NodeId
  /** The layer's scale is already in the primitive's size. */
  folded: boolean
  /** Turning it changes nothing, as with a sphere about its centre. */
  turnFree: boolean
}

function primitive(layer: ShapeLayer, add: Add): Primitive {
  const [sx, sy, sz] = layer.scl
  const uniform = sx === sy && sy === sz
  const round = sx === sz
  const done = (id: NodeId, folded: boolean, turnFree = false): Primitive => ({
    id,
    folded,
    turnFree,
  })
  switch (layer.kind) {
    case 'sphere': {
      const radius = uniform ? tidy(layer.params.radius * sx) : layer.params.radius
      return done(add({ kind: 'sphere', radius }), uniform, uniform)
    }
    case 'box': {
      const { width, height, depth } = layer.params
      const half: Vec3 = [tidy((width / 2) * sx), tidy((height / 2) * sy), tidy((depth / 2) * sz)]
      return done(add({ kind: 'box', half }), true)
    }
    case 'cylinder': {
      const r = round ? tidy(layer.params.radius * sx) : layer.params.radius
      const h = round ? tidy(layer.params.height * sy) : layer.params.height
      return done(add({ kind: 'cylinder', radius: r, height: h, axis: 'y' }), round)
    }
    case 'torus': {
      const k = uniform ? sx : 1
      const node: CsgNode = {
        kind: 'torus',
        major: tidy(layer.params.major * k),
        minor: tidy(layer.params.minor * k),
        axis: 'y',
      }
      return done(add(node), uniform)
    }
    case 'triangle':
      return done(triangle(layer.params, layer.scl, add), true)
    case 'cone':
      return done(cone(layer.params, round ? layer.scl : UNIT, add), round)
    case 'gyroid':
      return done(add({ kind: 'gyroid', ...layer.params }), false)
    case 'formula':
      return done(add({ kind: 'expression', source: layer.params.source }), false)
    case 'half':
      return done(add({ kind: 'plane', normal: [0, 1, 0], distance: 0 }), true)
  }
}

/** A prism: the box bounds it, and two planes slope its sides up to the apex. */
function triangle(
  params: { width: number; height: number; depth: number },
  [sx, sy, sz]: Vec3,
  add: Add,
): NodeId {
  const w = params.width * sx
  const h = params.height * sy
  const d = params.depth * sz
  const k = tidy((h * w) / 4)
  const box = add({ kind: 'box', half: [tidy(w / 2), tidy(h / 2), tidy(d / 2)] })
  const right = add({ kind: 'plane', normal: [tidy(h), tidy(w / 2), 0], distance: k })
  const left = add({ kind: 'plane', normal: [tidy(-h), tidy(w / 2), 0], distance: k })
  return add({ kind: 'intersect', children: [box, left, right] })
}

/**
 * A cone standing on its base: a cylinder half as wide, tapered to a point at the top
 * and out to its full radius at the bottom. `1 − 2y/H` is 2 at the base and 0 at the apex.
 */
function cone(params: { radius: number; height: number }, [sx, sy]: Vec3, add: Add): NodeId {
  const radius = tidy(params.radius * sx)
  const height = tidy(params.height * sy)
  const body = add({ kind: 'cylinder', radius: tidy(radius / 2), height, axis: 'y' })
  return add({ kind: 'taper', child: body, axis: 'y', amount: tidy(-2 / height) })
}

const DEG = Math.PI / 180
const AXES: readonly AxisName[] = ['x', 'y', 'z']

/** Which of a modifier's position axes mean anything when it is not turned. */
export function pivotAxes(layer: ModifierLayer): readonly AxisName[] {
  switch (layer.kind) {
    case 'mirror':
    case 'array':
      return [layer.params.axis]
    case 'distort':
      return layer.params.type === 'twist' ? AXES : [layer.params.along]
    case 'radial':
    case 'revolve':
      return ['x', 'z']
    default:
      return AXES
  }
}

/** The point a modifier works about: all of `pos` when it is turned, else its pivot axes. */
export function pivotOf(layer: ModifierLayer): Vec3 {
  if (isTurned(layer.rot)) return layer.pos
  const used = pivotAxes(layer)
  const keep = (i: 0 | 1 | 2): number => (used.includes(AXES[i]!) ? layer.pos[i] : 0)
  return [keep(0), keep(1), keep(2)]
}

/**
 * A modifier around its own frame: into it, the modifier's node, and back out. A modifier
 * that is not turned only needs the translation, which stays two `translate` nodes the
 * simplifier can see through rather than two affine ones.
 */
function modifierNode(layer: ModifierLayer, child: NodeId, add: Add): NodeId {
  const pivot = pivotOf(layer)
  const turned = isTurned(layer.rot)
  const moved = isMoved(pivot)
  const frame = modifierFrame(layer)
  if (frame === null) return child
  const [px, py, pz] = pivot
  let inner = child
  if (turned) inner = add({ kind: 'affine', child: inner, matrix: placement(pivot, layer.rot) })
  else if (moved) inner = add({ kind: 'translate', child: inner, offset: [-px, -py, -pz] })
  const node = add(frame(inner))
  if (turned) {
    return add({ kind: 'affine', child: node, matrix: placementInverse(pivot, layer.rot, UNIT) })
  }
  return moved ? add({ kind: 'translate', child: node, offset: pivot }) : node
}

type FrameBuilder = (child: NodeId) => CsgNode

/** The modifier's own node about the origin, or nothing when it would change nothing. */
function modifierFrame(layer: ModifierLayer): FrameBuilder | null {
  switch (layer.kind) {
    case 'mirror':
      return (child) => ({
        kind: 'mirror',
        child,
        axis: layer.params.axis,
        keep: layer.params.side === '+' ? 'positive' : 'negative',
      })
    case 'distort': {
      const p = layer.params
      if (p.type === 'twist') {
        const rate = tidy((p.twist * DEG) / 2)
        return rate === 0 ? null : (child) => ({ kind: 'twist', child, axis: 'y', rate })
      }
      if (p.axis === p.along || p.amplitude === 0) return null
      return (child) => ({ kind: 'wave', child, axis: p.axis, along: p.along, ...pick(p) })
    }
    case 'array': {
      const count = Math.round(layer.params.count)
      return count < 2 ? null : (child) => ({ kind: 'array', child, ...layer.params, count })
    }
    case 'radial': {
      const count = Math.round(layer.params.count)
      return count < 2 ? null : (child) => ({ kind: 'radial', child, axis: 'y', count })
    }
    case 'bend': {
      const p = layer.params
      const degrees = Math.max(-720, Math.min(720, p.angle))
      if (degrees === 0 || p.axis === p.toward) return null
      const side = p.side === 'both' ? 'both' : p.side === '+' ? 'positive' : 'negative'
      const rate = tidy(degrees * DEG)
      return (child) => ({ kind: 'bend', child, axis: p.axis, toward: p.toward, side, rate })
    }
    case 'taper':
      return layer.params.amount === 0
        ? null
        : (child) => ({ kind: 'taper', child, axis: 'y', amount: layer.params.amount })
    case 'revolve':
      return (child) => ({ kind: 'revolve', child, axis: 'y' })
  }
}

const pick = (p: { amplitude: number; frequency: number }) => ({
  amplitude: p.amplitude,
  frequency: p.frequency,
})
