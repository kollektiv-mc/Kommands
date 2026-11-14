/**
 * The value ladder's arithmetic: a middle drag on a number field, as in Houdini.
 *
 * Up and down pick the step, one rung per row of the ladder; left and right change the
 * value by that step, one step every few pixels. Moving to another rung counts from the
 * value as it is then, so switching never makes the value jump.
 */

export const RUNGS = [100, 10, 1, 0.1, 0.01, 0.001] as const

/** A rung's height: the ladder's rows are `h-7`. */
export const RUNG_HEIGHT = 28
/** Sideways travel per step. */
const PX_PER_STEP = 12

export interface Ladder {
  /** The rung the drag started on, and where. */
  first: number
  y0: number
  /** The rung in use, and where the pointer was when it was taken. */
  rung: number
  x0: number
  /** The value when this rung was taken, and now. */
  base: number
  value: number
}

/** The rung a field's own step starts on: the largest step no coarser than it. */
export function rungOf(step: number): number {
  const i = RUNGS.findIndex((r) => r <= step * 1.0001)
  return i < 0 ? RUNGS.length - 1 : i
}

export function startLadder(value: number, step: number, x: number, y: number): Ladder {
  const rung = rungOf(step)
  return { first: rung, y0: y, rung, x0: x, base: value, value }
}

/** Where the ladder is with the pointer at `x`, `y`. */
export function moveLadder(l: Ladder, x: number, y: number): Ladder {
  const rung = Math.max(
    0,
    Math.min(RUNGS.length - 1, l.first + Math.round((y - l.y0) / RUNG_HEIGHT)),
  )
  const at = rung === l.rung ? l : { ...l, rung, base: l.value, x0: x }
  const step = RUNGS[rung] ?? 1
  const n = Math.round((x - at.x0) / PX_PER_STEP)
  // Rounded to the finest rung, not this one, so taking a coarser rung keeps the decimals.
  const value = Number((at.base + n * step).toFixed(FINEST))
  return { ...at, value }
}

const FINEST = 3
