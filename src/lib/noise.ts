/**
 * Ken Perlin's improved 3D noise, and the one use the dashboard makes of it: how large
 * each dot in the background grid is at a given moment.
 *
 * Seeded with a fixed shuffle, so the grid moves the same way on every launch.
 */

const PERMUTATION: readonly number[] = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i)
  let seed = 1337
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[p[i], p[j]] = [p[j]!, p[i]!]
  }
  return [...p, ...p]
})()

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return (h & 1 ? -u : u) + (h & 2 ? -v : v)
}

/** Noise at a point, roughly in -1..1, and continuous in all three axes. */
export function perlin(x: number, y: number, z: number): number {
  const P = PERMUTATION
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const Z = Math.floor(z) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  z -= Math.floor(z)
  const u = fade(x)
  const v = fade(y)
  const w = fade(z)
  const A = P[X]! + Y
  const AA = P[A]! + Z
  const AB = P[A + 1]! + Z
  const B = P[X + 1]! + Y
  const BA = P[B]! + Z
  const BB = P[B + 1]! + Z
  return lerp(
    lerp(
      lerp(grad(P[AA]!, x, y, z), grad(P[BA]!, x - 1, y, z), u),
      lerp(grad(P[AB]!, x, y - 1, z), grad(P[BB]!, x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(grad(P[AA + 1]!, x, y, z - 1), grad(P[BA + 1]!, x - 1, y, z - 1), u),
      lerp(grad(P[AB + 1]!, x, y - 1, z - 1), grad(P[BB + 1]!, x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  )
}

/**
 * How swollen the dot at a grid cell is at `seconds`, from 0 to 1.
 *
 * Two octaves drifting in different directions, so the waves are uneven rather than a
 * single front rolling across the grid.
 */
export function dotLevel(col: number, row: number, seconds: number): number {
  const n =
    0.55 * perlin(col * 0.08 + seconds * 0.04, row * 0.08, seconds * 0.22) +
    0.3 * perlin(col * 0.19, row * 0.19 - seconds * 0.05, seconds * 0.37 + 40)
  return Math.max(0, Math.min(1, 0.5 + n))
}
