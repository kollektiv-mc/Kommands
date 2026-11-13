import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  extrude,
  FACE_ORIGIN,
  FACE_REACH,
  MARK,
  type Point,
  RESTING_FRAME,
  SPLASH_MS,
  splashClock,
  splashFrame,
} from './splashMark'

const svg = readFileSync('docs/brand/mark-on-dark.svg', 'utf8')
const polygons = [...svg.matchAll(/points="([^"]+)"/g)].map((m) => m[1])
const pts = (p: readonly Point[]) => p.join(' ')

describe('splash mark', () => {
  test('every part is a polygon of the brand file', () => {
    for (const part of Object.values(MARK)) expect(polygons).toContain(pts(part))
  })

  test('comes to rest as the static mark', () => {
    expect(RESTING_FRAME).toEqual({
      promptOpacity: 0,
      faceRadius: FACE_REACH,
      depth: 1,
      bracketShift: 0,
      bracketOpacity: 1,
    })
    const block = extrude(RESTING_FRAME.depth)
    expect(near(block.top, rotate(MARK.top, 3))).toBe(true)
    expect(near(block.right, MARK.right)).toBe(true)
    expect(near(block.base, rotate(MARK.hexagon, 4))).toBe(true)
  })

  test('fills the whole left face from the prompt', () => {
    for (const [x, y] of MARK.left) {
      expect(Math.hypot(x - FACE_ORIGIN[0], y - FACE_ORIGIN[1])).toBeLessThan(FACE_REACH)
    }
  })

  test('starts on the prompt alone', () => {
    const first = splashFrame(SPLASH_MS.promptIn)
    expect(first.promptOpacity).toBe(1)
    expect(first.faceRadius).toBe(0)
    expect(first.depth).toBe(0)
    expect(first.bracketOpacity).toBe(0)
  })

  test('flashes the prompt twice, then clears it before the face', () => {
    const shown = (ms: number) => splashFrame(ms).promptOpacity > 0
    const [[, firstOff], [secondOn, secondOff]] = SPLASH_MS.flashes
    expect([firstOff, secondOn - 1, secondOn, secondOff - 1, secondOff].map(shown)).toEqual([
      false,
      false,
      true,
      true,
      false,
    ])
    // A gap with nothing drawn, so the second flash is never cut short by the face.
    expect(secondOff).toBeLessThan(SPLASH_MS.faceStart)
    expect(splashFrame(SPLASH_MS.faceStart).faceRadius).toBe(0)
  })

  test('has the face filled in before it extrudes far', () => {
    const extruding = splashFrame(SPLASH_MS.faceStart + SPLASH_MS.face)
    expect(extruding.faceRadius).toBe(FACE_REACH)
    expect(extruding.depth).toBeLessThan(0.5)
  })

  test('fades the overlay after everything has landed', () => {
    const last = Math.max(
      SPLASH_MS.extrudeStart + SPLASH_MS.extrude,
      SPLASH_MS.bracketsStart + SPLASH_MS.brackets,
    )
    expect(SPLASH_MS.fadeStart).toBeGreaterThan(last)
    expect(splashFrame(last)).toEqual(RESTING_FRAME)
  })
})

describe('splash clock', () => {
  const feed = (clock: (now: number) => number, frames: number[]) => frames.map(clock)

  test('holds until frames have run on time for a while', () => {
    const out = feed(splashClock(), [0, 16, 32, 48, 64, 80, 96, 112])
    expect(out.slice(0, 6)).toEqual([-1, -1, -1, -1, -1, -1])
    expect(out.slice(6)).toEqual([0, 16])
  })

  test('stops holding once a busy start has run long', () => {
    const out = feed(splashClock(), [0, 100, 200, 300, 400, 500, 600, 700])
    expect(out.at(-2)).toBe(-1)
    expect(out.at(-1)).toBe(0)
  })

  test('pauses on a late frame rather than jumping', () => {
    const out = feed(splashClock(), [0, 16, 32, 48, 64, 80, 96, 296, 312])
    expect(out.slice(-2)).toEqual([34, 50])
  })
})

/** Two polygons with the same corners, to well under what any screen can show. */
function near(a: readonly Point[], b: readonly Point[]): boolean {
  return (
    a.length === b.length && a.every((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 1e-9)
  )
}

/** The same polygon from another starting corner. */
function rotate(points: readonly Point[], by: number): Point[] {
  return [...points.slice(by), ...points.slice(0, by)]
}
