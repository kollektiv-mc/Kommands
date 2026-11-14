import type { AxisName, ModifierLayer, ModifierParams, Vec3 } from '../../../worldedit/stack/layers'

/**
 * What each modifier draws in the view, about its own pivot: the mirror plane, the
 * wave, the twist helix, the array's copies, the radial spokes, the bend's guide and the
 * arc it bends into, the taper's outline, the revolve axis.
 *
 * Plain lines in the modifier's frame, so the view places them where `lower.ts` puts the
 * modifier (`pivotOf`, then its turn) and they move with the gizmo.
 */
export interface Guide {
  /** Polylines, each a run of points, with how strongly each is drawn. */
  lines: { points: Vec3[]; strength: number }[]
  /** Mirror's plane: the axis it is square to. */
  plane: AxisName | null
}

const DEG = Math.PI / 180
/** How far a bend's guide reaches either side of its pivot. */
export const BEND_REACH = 1.2

const along = (axis: AxisName, v: number): Vec3 => [
  axis === 'x' ? v : 0,
  axis === 'y' ? v : 0,
  axis === 'z' ? v : 0,
]
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const steps = (n: number, f: (t: number) => Vec3): Vec3[] =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n))
const circle = (r: number, y: number): Vec3[] =>
  steps(64, (t) => [r * Math.cos(t * Math.PI * 2), y, r * Math.sin(t * Math.PI * 2)])

export function guideOf(layer: ModifierLayer): Guide {
  const lines: Guide['lines'] = []
  const line = (points: Vec3[], strength = 1) => lines.push({ points, strength })
  switch (layer.kind) {
    case 'mirror':
      return { lines, plane: layer.params.axis }
    case 'distort': {
      const p = layer.params
      if (p.type === 'twist') {
        const k = (p.twist * DEG) / 2
        line(
          [
            [0, -1.15, 0],
            [0, 1.15, 0],
          ],
          0.6,
        )
        for (const phase of [0, Math.PI]) {
          line(
            steps(80, (t) => {
              const y = -1 + 2 * t
              return [0.62 * Math.cos(k * y + phase), y, 0.62 * Math.sin(k * y + phase)]
            }),
          )
        }
      } else if (p.axis !== p.along) {
        line([along(p.along, -1.2), along(p.along, 1.2)], 0.35)
        line(
          steps(160, (t) => {
            const u = -1.2 + 2.4 * t
            return plus(along(p.along, u), along(p.axis, p.amplitude * Math.sin(u * p.frequency)))
          }),
        )
      }
      break
    }
    case 'array': {
      const { axis, spacing } = layer.params
      const n = Math.max(1, Math.round(layer.params.count))
      line([along(axis, 0), along(axis, (n - 1) * spacing)], 0.5)
      const [a, b] =
        axis === 'y' ? (['x', 'z'] as const) : (['y', axis === 'x' ? 'z' : 'x'] as const)
      for (let i = 0; i < n; i++) {
        const c = along(axis, i * spacing)
        const corner = (sa: number, sb: number) =>
          plus(plus(c, along(a, 0.12 * sa)), along(b, 0.12 * sb))
        line(
          [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1), corner(1, 1)],
          i === 0 ? 1 : 0.7,
        )
      }
      break
    }
    case 'radial': {
      const n = Math.max(2, Math.round(layer.params.count))
      line(
        [
          [0, -1.1, 0],
          [0, 1.1, 0],
        ],
        0.4,
      )
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        line(
          [
            [0, 0, 0],
            [0.95 * Math.cos(a), 0, 0.95 * Math.sin(a)],
          ],
          i === 0 ? 1 : 0.6,
        )
      }
      line(circle(0.95, 0), 0.3)
      break
    }
    case 'bend': {
      const p = layer.params
      line([along(p.axis, -BEND_REACH), along(p.axis, BEND_REACH)])
      const th = p.angle * DEG
      if (th !== 0 && p.axis !== p.toward) {
        const lo = p.side === '+' ? 0 : -BEND_REACH
        const hi = p.side === '-' ? 0 : BEND_REACH
        line(
          steps(90, (t) => {
            const s = (lo + (hi - lo) * t) * th
            return plus(along(p.axis, Math.sin(s) / th), along(p.toward, (1 - Math.cos(s)) / th))
          }),
          0.45,
        )
      }
      break
    }
    case 'taper': {
      const w = (y: number) => 0.5 * (1 + layer.params.amount * y)
      for (const a of ['x', 'z'] as const) {
        const at = (s: number, y: number) => plus(along(a, s * w(y)), [0, y, 0])
        line([at(-1, -1), at(1, -1), at(1, 1), at(-1, 1), at(-1, -1)], a === 'x' ? 1 : 0.5)
      }
      break
    }
    case 'revolve':
      line([
        [0, -1.15, 0],
        [0, 1.15, 0],
      ])
      line(circle(0.6, 0.45), 0.7)
      line(circle(0.6, -0.45), 0.7)
      break
  }
  return { lines, plane: null }
}

/**
 * Where a selected bend's handle sits: the tip of the bent guide. Dragging it sets the
 * angle so the tip follows the pointer.
 */
export function bendTip(params: ModifierParams['bend']): Vec3 {
  const e = params.side === '-' ? -1 : 1
  const th = params.angle * DEG
  if (Math.abs(th) < 1e-6) return along(params.axis, e * BEND_REACH)
  return plus(
    along(params.axis, (e * Math.sin(BEND_REACH * th)) / th),
    along(params.toward, (1 - Math.cos(BEND_REACH * th)) / th),
  )
}

/**
 * The angle that points a bend's tip at `local`, a point in the modifier's frame: an
 * arc's chord leans half its turn, so the angle is twice the lean over the guide's reach.
 * Whole degrees, or fives with Snap on.
 */
export function bendAngleToward(
  params: { axis: AxisName; toward: AxisName; side: string },
  local: Vec3,
  snap: boolean,
): number {
  const index = { x: 0, y: 1, z: 2 } as const
  const s = local[index[params.axis]]
  const u = local[index[params.toward]]
  const lean = Math.atan2(u, (params.side === '-' ? -1 : 1) * s)
  const degrees = (2 * lean) / BEND_REACH / DEG
  return snap ? Math.round(degrees / 5) * 5 : Math.round(degrees)
}
