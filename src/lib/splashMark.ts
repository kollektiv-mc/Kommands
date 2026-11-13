/*
 * The geometry and timeline of the startup splash: the Kommands mark
 * (docs/brand/README.md) built up in motion. The prompt shows alone,
 * flashes twice like a cursor and goes, the block's left face fills in where
 * it was, the face extrudes
 * back into the block, and the brackets close in, so the last frame is the
 * static mark exactly.
 *
 * Everything is in the mark's own 24-unit grid; the numbers are those of
 * docs/brand/mark-on-dark.svg. The frame is a pure function of milliseconds
 * and the clock is Konnekt's (frontend/src/lib/splashMark.ts), so the two
 * products open on the same rhythm with their own marks.
 */

export type Point = readonly [number, number]

/** The mark at rest, as docs/brand/mark-on-dark.svg draws it. */
export const MARK = {
  top: [
    [12, 4.7],
    [18.322, 8.35],
    [12, 12],
    [5.678, 8.35],
  ],
  /** Outer top, front top, front bottom, outer bottom. */
  left: [
    [5.678, 8.35],
    [12, 12],
    [12, 19.3],
    [5.678, 15.65],
  ],
  right: [
    [12, 12],
    [18.322, 8.35],
    [18.322, 15.65],
    [12, 19.3],
  ],
  hexagon: [
    [12, 4.7],
    [18.322, 8.35],
    [18.322, 15.65],
    [12, 19.3],
    [5.678, 15.65],
    [5.678, 8.35],
  ],
  prompt: [
    [6.554, 11.688],
    [8.496, 12.809],
    [6.554, 13.93],
    [6.554, 15.448],
    [11.124, 12.809],
    [6.554, 10.171],
  ],
  bracketLeft: [
    [8.075, 3.1],
    [2.33, 6.417],
    [2.33, 17.583],
    [8.075, 20.9],
    [8.075, 19.168],
    [3.83, 16.717],
    [3.83, 7.283],
    [8.075, 4.832],
  ],
  bracketRight: [
    [15.925, 4.832],
    [20.17, 7.283],
    [20.17, 16.717],
    [15.925, 19.168],
    [15.925, 20.9],
    [21.67, 17.583],
    [21.67, 6.417],
    [15.925, 3.1],
  ],
} satisfies Record<string, Point[]>

/**
 * The block's depth axis on screen: the edge from the left face's front to the
 * back of the block. Extruding the left face along it sweeps out the top and
 * the right face, which is the whole block.
 */
export const DEPTH: Point = [6.322, -3.65]

/** Where the left face fills in from: the middle of the prompt. */
export const FACE_ORIGIN: Point = [8.6, 12.8]
/** A reach from FACE_ORIGIN past every corner of the left face. */
export const FACE_REACH = 9

/** Milliseconds: when each part starts and how long it runs. */
export const SPLASH_MS = {
  /** The first flash's fade in; every other step of the flashes is a cut, like a cursor. */
  promptIn: 80,
  /** The prompt's two flashes, each [on, off]. It is gone before its face fills in. */
  flashes: [
    [0, 200],
    [320, 520],
  ] as const,
  faceStart: 600,
  face: 280,
  extrudeStart: 840,
  extrude: 300,
  bracketsStart: 940,
  brackets: 320,
  bracketsIn: 160,
  /** The finished mark holds, then the overlay fades. */
  fadeStart: 1400,
  fade: 250,
  /** Under reduced motion: the finished mark, held and faded. */
  still: 600,
}

/** How far outside its place each bracket starts. */
const BRACKET_TRAVEL = 3

export interface SplashFrame {
  /** The prompt flashing on its own, before its face is there to cut it from. */
  promptOpacity: number
  /** How far the left face has filled in from FACE_ORIGIN. */
  faceRadius: number
  /** How far the face has extruded into the block, 0 to 1. */
  depth: number
  /** Units each bracket still sits outside its place. */
  bracketShift: number
  bracketOpacity: number
}

/** The mark `ms` into the splash. Past the end it is the static mark. */
export function splashFrame(ms: number): SplashFrame {
  const flash = SPLASH_MS.flashes.findIndex(([on, off]) => ms >= on && ms < off)
  const brackets = span(ms, SPLASH_MS.bracketsStart, SPLASH_MS.brackets)
  return {
    promptOpacity: flash === 0 ? span(ms, 0, SPLASH_MS.promptIn) : flash > 0 ? 1 : 0,
    faceRadius: FACE_REACH * easeOutCubic(span(ms, SPLASH_MS.faceStart, SPLASH_MS.face)),
    depth: easeOutCubic(span(ms, SPLASH_MS.extrudeStart, SPLASH_MS.extrude)),
    bracketShift: BRACKET_TRAVEL * (1 - easeOutCubic(brackets)),
    bracketOpacity: span(ms, SPLASH_MS.bracketsStart, SPLASH_MS.bracketsIn),
  }
}

/** The static mark, for reduced motion and the last frame. */
export const RESTING_FRAME = splashFrame(SPLASH_MS.fadeStart)

export interface Extrusion {
  /** The block's outline so far, filled with the left shade under the faces. */
  base: Point[]
  top: Point[]
  right: Point[]
}

/** The left face pushed `depth` of the way back along DEPTH. */
export function extrude(depth: number): Extrusion {
  const [a, b, c, d] = MARK.left
  const back = ([x, y]: Point): Point => [x + DEPTH[0] * depth, y + DEPTH[1] * depth]
  return {
    base: [d, a, back(a), back(b), back(c), c],
    top: [a, back(a), back(b), b],
    right: [b, back(b), back(c), c],
  }
}

/*
 * The splash mounts in the same frame as the dashboard, whose first render
 * arrives as a burst of long tasks. Played from mount, the animation would
 * spend that burst skipping ahead in jumps. So its clock holds at zero, on a
 * blank overlay, until frames have run on time for a while, and once running
 * never advances by more than a slow frame: a late frame then pauses the
 * motion instead of jumping it. Konnekt's splash clock, unchanged.
 */
// Two 60Hz frames: a frame within it is on time, and once running the
// timeline advances by no more than it.
const SLOW_FRAME_MS = 34
const CALM_FRAMES = 6
const MAX_HOLD_MS = 700

/**
 * A clock for the splash timeline, fed each frame's rAF timestamp. Returns the
 * timeline's milliseconds, or -1 while it is still holding for the start.
 */
export function splashClock(): (now: number) => number {
  let last: number | undefined
  let held = 0
  let calm = 0
  let ms = -1
  return (now) => {
    const step = last === undefined ? 0 : now - last
    last = now
    if (ms < 0) {
      held += step
      calm = step > 0 && step <= SLOW_FRAME_MS ? calm + 1 : 0
      if (calm >= CALM_FRAMES || held >= MAX_HOLD_MS) ms = 0
      return ms
    }
    ms += Math.min(step, SLOW_FRAME_MS)
    return ms
  }
}

/** A part's progress, 0 before `start` and 1 once `duration` has run. */
function span(ms: number, start: number, duration: number): number {
  return Math.min(1, Math.max(0, (ms - start) / duration))
}

function easeOutCubic(x: number): number {
  return 1 - (1 - x) ** 3
}
