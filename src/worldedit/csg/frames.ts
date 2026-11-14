import type { Expr } from '../expression/ast'
import { printExpr } from '../expression/print'
import { add, call, div, mul, name, negate, num, square, sub } from './builders'
import { axisFrame, perpendicular, turn, type FrameNode } from './tree'

// ── Frames ─────────────────────────────────────────────────────────────────

/** The three coordinate expressions a node is evaluated against. */
export type Frame = readonly [Expr, Expr, Expr]

export const ROOT_FRAME: Frame = [name('x'), name('y'), name('z')]

export const frameKey = (frame: Frame): string => frame.map(printExpr).join('|')

/**
 * The frame a transform's child sees.
 *
 * Transforms map the *point*, not the shape: to ask whether p is inside a shape moved by
 * d, ask whether p − d is inside the shape that has not moved. So every entry here is
 * the inverse of what the node is named after.
 */
export function childFrame(node: FrameNode, frame: Frame): Frame {
  switch (node.kind) {
    case 'translate':
    case 'scale':
    case 'rotate':
    case 'affine':
      return linearFrame(node, frame)
    case 'mirror':
    case 'wave':
    case 'twist':
    case 'array':
      return foldingFrame(node, frame)
    default:
      return curvingFrame(node, frame)
  }
}

const at = (axis: 'x' | 'y' | 'z'): 0 | 1 | 2 => AXIS_INDEX[axis]

/** The frame with some coordinates replaced. */
function replaced(frame: Frame, changes: ReadonlyArray<readonly [0 | 1 | 2, Expr]>): Frame {
  const next: [Expr, Expr, Expr] = [frame[0], frame[1], frame[2]]
  for (const [i, expr] of changes) next[i] = expr
  return next
}

/** The transforms: each coordinate stays a linear form in the parent's. */
function linearFrame(
  node: Extract<FrameNode, { kind: 'translate' | 'scale' | 'rotate' | 'affine' }>,
  frame: Frame,
): Frame {
  const replace = (changes: ReadonlyArray<readonly [0 | 1 | 2, Expr]>): Frame =>
    replaced(frame, changes)
  switch (node.kind) {
    case 'translate':
      return [
        sub(frame[0], num(node.offset[0])),
        sub(frame[1], num(node.offset[1])),
        sub(frame[2], num(node.offset[2])),
      ]

    case 'scale':
      return [
        div(frame[0], num(node.factor[0])),
        div(frame[1], num(node.factor[1])),
        div(frame[2], num(node.factor[2])),
      ]

    case 'rotate': {
      // Two linear combinations with constant coefficients — never the `rotate()`
      // built-in, which writes back through its arguments and so demands bare variable
      // names. Turned by −angle, because the point moves opposite to the shape.
      const { u, v } = axisFrame(node.axis)
      const { cos, sin } = turn(node.angle)
      return replace([
        [u, add(mul(frame[u], num(cos)), mul(frame[v], num(sin)))],
        [v, add(mul(frame[u], num(-sin)), mul(frame[v], num(cos)))],
      ])
    }

    case 'affine': {
      const m = node.matrix
      const row = (r: number): Expr =>
        add(
          add(
            add(mul(frame[0], num(m[r * 4]!)), mul(frame[1], num(m[r * 4 + 1]!))),
            mul(frame[2], num(m[r * 4 + 2]!)),
          ),
          num(m[r * 4 + 3]!),
        )
      return [row(0), row(1), row(2)]
    }
  }
}

/** Mirror, wave, twist and array: each folds or pushes coordinates it already has. */
function foldingFrame(
  node: Extract<FrameNode, { kind: 'mirror' | 'wave' | 'twist' | 'array' }>,
  frame: Frame,
): Frame {
  const replace = (changes: ReadonlyArray<readonly [0 | 1 | 2, Expr]>): Frame =>
    replaced(frame, changes)
  switch (node.kind) {
    case 'mirror': {
      const i = at(node.axis)
      const folded = call('abs', [frame[i]])
      return replace([[i, node.keep === 'positive' ? folded : negate(folded)]])
    }

    case 'wave': {
      const i = at(node.axis)
      const push = mul(
        num(node.amplitude),
        call('sin', [mul(frame[at(node.along)], num(node.frequency))]),
      )
      return replace([[i, sub(frame[i], push)]])
    }

    case 'twist': {
      if (node.rate === 0) return frame
      const { u, v, w } = axisFrame(node.axis)
      const angle = mul(frame[w], num(node.rate))
      const cos = call('cos', [angle])
      const sin = call('sin', [angle])
      return replace([
        [u, add(mul(frame[u], cos), mul(frame[v], sin))],
        [v, sub(mul(frame[v], cos), mul(frame[u], sin))],
      ])
    }

    case 'array': {
      if (node.count <= 1) return frame
      const i = at(node.axis)
      const step = num(node.spacing)
      const index = call('min', [
        call('max', [call('round', [div(frame[i], step)]), num(0)]),
        num(node.count - 1),
      ])
      return replace([[i, sub(frame[i], mul(step, index))]])
    }
  }
}

/** Radial, bend, taper and revolve: each reads its child in polar or curved coordinates. */
function curvingFrame(
  node: Extract<FrameNode, { kind: 'radial' | 'bend' | 'taper' | 'revolve' }>,
  frame: Frame,
): Frame {
  const replace = (changes: ReadonlyArray<readonly [0 | 1 | 2, Expr]>): Frame =>
    replaced(frame, changes)
  switch (node.kind) {
    case 'radial': {
      if (node.count <= 1) return frame
      const [p, q] = perpendicular(node.axis)
      const sector = num((2 * Math.PI) / node.count)
      const angle = call('atan2', [frame[q], frame[p]])
      const local = sub(angle, mul(sector, call('round', [div(angle, sector)])))
      const radius = call('sqrt', [add(square(frame[p]), square(frame[q]))])
      return replace([
        [p, mul(radius, call('cos', [local]))],
        [q, mul(radius, call('sin', [local]))],
      ])
    }

    case 'bend': {
      if (node.rate === 0) return frame
      const s = at(node.axis)
      const u = at(node.toward)
      const towards = node.rate > 0
      const radius = num(1 / Math.abs(node.rate))
      const lean = towards ? frame[u] : negate(frame[u])
      const gap = sub(radius, lean)
      const along =
        node.side === 'both'
          ? frame[s]
          : call(node.side === 'positive' ? 'max' : 'min', [frame[s], num(0)])
      const arc = mul(radius, call('atan2', [along, gap]))
      const kept =
        node.side === 'both'
          ? undefined
          : call(node.side === 'positive' ? 'min' : 'max', [frame[s], num(0)])
      const off = sub(radius, call('sqrt', [add(square(along), square(gap))]))
      return replace([
        [s, kept === undefined ? arc : add(kept, arc)],
        [u, towards ? off : negate(off)],
      ])
    }

    case 'taper': {
      if (node.amount === 0) return frame
      const [p, q] = perpendicular(node.axis)
      const w = at(node.axis)
      const width =
        node.amount < 0
          ? sub(num(1), mul(num(-node.amount), frame[w]))
          : add(num(1), mul(num(node.amount), frame[w]))
      return replace([
        [p, div(frame[p], width)],
        [q, div(frame[q], width)],
      ])
    }

    case 'revolve': {
      const [p, q] = perpendicular(node.axis)
      return replace([
        [p, call('sqrt', [add(square(frame[p]), square(frame[q]))])],
        [q, num(0)],
      ])
    }
  }
}

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const
