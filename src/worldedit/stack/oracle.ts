import { compileExpression } from '../expression'
import {
  actsBelow,
  type Layer,
  type ModifierLayer,
  type ModifierParams,
  type Op,
  type ShapeLayer,
  type Vec3,
} from './layers'

/**
 * What a layer stack means, read straight off the layers, for testing `lower.ts`.
 *
 * Written from the editor's rules rather than from the lowering, and deliberately
 * naive: every shape is asked through every modifier above it one at a time, where the
 * lowering groups runs of shapes and wraps each run once; placements are undone with
 * three plain rotations, where the lowering composes one affine node; and a modifier
 * always works about its whole position, where the lowering drops the axes its pivot
 * does not use. If any of those shortcuts changed what the stack means, the two
 * disagree. Like `csg/reference.ts`, nothing outside the tests should use this.
 */

type Point = [number, number, number]
const DEG = Math.PI / 180

function spin(p: Point, axis: 0 | 1 | 2, degrees: number): Point {
  const c = Math.cos(degrees * DEG)
  const s = Math.sin(degrees * DEG)
  const [x, y, z] = p
  if (axis === 0) return [x, c * y - s * z, s * y + c * z]
  if (axis === 1) return [c * x + s * z, y, -s * x + c * z]
  return [c * x - s * y, s * x + c * y, z]
}

/** `Rx·Ry·Rz·p`: Three's XYZ Euler order, so z turns first. */
const turnBy = (p: Point, [rx, ry, rz]: Vec3): Point => spin(spin(spin(p, 2, rz), 1, ry), 0, rx)
const unturnBy = (p: Point, [rx, ry, rz]: Vec3): Point =>
  spin(spin(spin(p, 0, -rx), 1, -ry), 2, -rz)

function toLocal(p: Point, layer: { pos: Vec3; rot: Vec3; scl: Vec3 }): Point {
  const [x, y, z] = unturnBy(
    [p[0] - layer.pos[0], p[1] - layer.pos[1], p[2] - layer.pos[2]],
    layer.rot,
  )
  return [x / layer.scl[0], y / layer.scl[1], z / layer.scl[2]]
}

const joined = (op: Op, a: boolean, b: boolean): boolean =>
  op === 'add' ? a || b : op === 'cut' ? a && !b : a && b

/** Whether a list builds anything at all: it does once an Add has something in it. */
export function builds(layers: readonly Layer[]): boolean {
  return layers.some(
    (layer) =>
      layer.visible &&
      layer.type !== 'reference' &&
      !actsBelow(layer) &&
      layer.op === 'add' &&
      (layer.type !== 'group' || builds(layer.children)),
  )
}

export function insideStack(layers: readonly Layer[], p: Point): boolean {
  let started = false
  let inside = false
  const above: Array<ModifierLayer | ShapeLayer> = []
  for (const layer of layers) {
    if (!layer.visible || layer.type === 'reference') continue
    if (actsBelow(layer)) {
      above.push(layer)
      continue
    }
    if (layer.type === 'group' && !builds(layer.children)) continue
    const here = through(above, 0, layer, p)
    if (!started) {
      if (layer.op === 'add') [started, inside] = [true, here]
      continue
    }
    inside = joined(layer.op, inside, here)
  }
  return inside
}

function through(
  above: ReadonlyArray<ModifierLayer | ShapeLayer>,
  i: number,
  layer: Layer,
  p: Point,
): boolean {
  const wrap = above[i]
  if (wrap === undefined) return insideLayer(layer, p)
  if (wrap.type === 'modifier') return through(above, i + 1, layer, warp(wrap, p))
  return joined(wrap.op, through(above, i + 1, layer, p), insideLayer(wrap, p))
}

function insideLayer(layer: Layer, p: Point): boolean {
  if (layer.type === 'reference' || layer.type === 'modifier') return false
  const q = toLocal(p, layer)
  if (layer.type === 'shape') return insideShape(layer, q)
  const placed =
    layer.pos.some((v) => v !== 0) ||
    layer.rot.some((v) => v % 360 !== 0) ||
    layer.scl.some((v) => v !== 1)
  const clipped = !placed || q.every((v) => Math.abs(v) < 1)
  return clipped && insideStack(layer.children, q)
}

function insideShape(layer: ShapeLayer, [x, y, z]: Point): boolean {
  switch (layer.kind) {
    case 'sphere':
      return x * x + y * y + z * z < layer.params.radius ** 2
    case 'box': {
      const { width, height, depth } = layer.params
      return Math.abs(x) < width / 2 && Math.abs(y) < height / 2 && Math.abs(z) < depth / 2
    }
    case 'cylinder':
      return x * x + z * z < layer.params.radius ** 2 && Math.abs(y) < layer.params.height / 2
    case 'torus':
      return (Math.hypot(x, z) - layer.params.major) ** 2 + y * y < layer.params.minor ** 2
    case 'triangle': {
      const { width: w, height: h, depth: d } = layer.params
      const inBox = Math.abs(x) < w / 2 && Math.abs(y) < h / 2 && Math.abs(z) < d / 2
      return inBox && h * Math.abs(x) + (w / 2) * y < (h * w) / 4
    }
    case 'cone': {
      const { radius: r, height: h } = layer.params
      return Math.abs(y) < h / 2 && x * x + z * z < (r / 2 - (r / h) * y) ** 2
    }
    case 'gyroid': {
      const f = layer.params.frequency
      const g =
        Math.sin(x * f) * Math.cos(y * f) +
        Math.sin(y * f) * Math.cos(z * f) +
        Math.sin(z * f) * Math.cos(x * f)
      return g < layer.params.threshold
    }
    case 'formula': {
      const result = compileExpression(layer.params.source)
      return result.ok && result.expression.evaluate(x, y, z) > 0
    }
    case 'half':
      return y < 0
  }
}

const INDEX = { x: 0, y: 1, z: 2 } as const

/** The point a modifier's child is asked at: into its frame, the warp, and back out. */
function warp(layer: ModifierLayer, p: Point): Point {
  const local = unturnBy([p[0] - layer.pos[0], p[1] - layer.pos[1], p[2] - layer.pos[2]], layer.rot)
  const [x, y, z] = turnBy(warpLocal(layer, local), layer.rot)
  return [x + layer.pos[0], y + layer.pos[1], z + layer.pos[2]]
}

function warpLocal(layer: ModifierLayer, p: Point): Point {
  const q: Point = [...p]
  switch (layer.kind) {
    case 'mirror': {
      const i = INDEX[layer.params.axis]
      q[i] = layer.params.side === '+' ? Math.abs(q[i]) : -Math.abs(q[i])
      return q
    }
    case 'distort':
      return distorted(layer.params, q)
    case 'array': {
      const { spacing, count } = layer.params
      const n = Math.round(count)
      const i = INDEX[layer.params.axis]
      if (n > 1) q[i] -= spacing * Math.min(Math.max(Math.round(q[i] / spacing), 0), n - 1)
      return q
    }
    case 'radial': {
      const n = Math.round(layer.params.count)
      if (n < 2) return q
      const sector = (2 * Math.PI) / n
      const angle = Math.atan2(q[2], q[0])
      const local = angle - sector * Math.round(angle / sector)
      const r = Math.hypot(q[0], q[2])
      return [r * Math.cos(local), q[1], r * Math.sin(local)]
    }
    case 'bend':
      return bent(layer.params, q)
    case 'taper': {
      const width = 1 + layer.params.amount * q[1]
      return [q[0] / width, q[1], q[2] / width]
    }
    case 'revolve':
      return [Math.hypot(q[0], q[2]), q[1], 0]
  }
}

function distorted(params: ModifierParams['distort'], q: Point): Point {
  if (params.type === 'twist') {
    const angle = q[1] * ((params.twist * DEG) / 2)
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return [q[0] * c - q[2] * s, q[1], q[0] * s + q[2] * c]
  }
  if (params.axis === params.along) return q
  const i = INDEX[params.axis]
  q[i] -= params.amplitude * Math.sin(q[INDEX[params.along]] * params.frequency)
  return q
}

/** A straight guide along `axis` curled towards `toward` by `angle` degrees per unit. */
function bent(
  params: {
    axis: 'x' | 'y' | 'z'
    toward: 'x' | 'y' | 'z'
    side: 'both' | '+' | '-'
    angle: number
  },
  q: Point,
): Point {
  const degrees = Math.max(-720, Math.min(720, params.angle))
  if (degrees === 0 || params.axis === params.toward) return q
  const s = INDEX[params.axis]
  const u = INDEX[params.toward]
  const sign = Math.sign(degrees)
  const radius = 1 / Math.abs(degrees * DEG)
  const gap = radius - sign * q[u]
  const one = params.side !== 'both'
  const along = !one ? q[s] : params.side === '+' ? Math.max(q[s], 0) : Math.min(q[s], 0)
  const kept = !one ? 0 : params.side === '+' ? Math.min(q[s], 0) : Math.max(q[s], 0)
  q[s] = kept + radius * Math.atan2(along, gap)
  q[u] = sign * (radius - Math.hypot(along, gap))
  return q
}
