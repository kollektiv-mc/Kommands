import { Color } from 'three'
import { parsePattern } from '../../../schema/argument-types/we-pattern'
import { bareId, blockCss } from '../swatch'

/**
 * The blocks as the view draws them: only the faces that can be seen, each coloured
 * from the pattern.
 *
 * One mesh of the exposed faces rather than a cube per block. An inner face is never
 * drawn, so a 64³ build is a few hundred thousand triangles rather than twelve per
 * block, and a face's colour is the colour of the block it belongs to.
 *
 * Headless, so what is drawn can be asserted without WebGL. `ViewportStage.tsx` only
 * hands these arrays to a buffer geometry.
 */

export interface Swatch {
  block: string
  /** Relative chance, as WorldEdit reads it: an unweighted entry is 1. */
  weight: number
  colour: Color
}

/** The pattern's blocks with their chances and colours, or stone for an empty one. */
export function blockPalette(pattern: string): Swatch[] {
  const swatches = parsePattern(pattern)
    .entries.map(({ block, weight }) => {
      const id = bareId(block)
      return { block: id, weight: weight === '' ? 1 : weight, colour: blockColour(id) }
    })
    .filter((s) => s.block !== '' && s.weight > 0)
  return swatches.length > 0
    ? swatches
    : [{ block: 'stone', weight: 1, colour: blockColour('stone') }]
}

/** A block's colour, as `swatch.ts` works it out. */
export function blockColour(id: string): Color {
  return new Color(blockCss(id))
}

/** The six faces of a unit cube: the neighbour's direction, then the quad's corners. */
const FACES: readonly (readonly [number, number, number, readonly (readonly number[])[]])[] = [
  [
    1,
    0,
    0,
    [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  ],
  [
    -1,
    0,
    0,
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  ],
  [
    0,
    1,
    0,
    [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  [
    0,
    -1,
    0,
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  ],
  [
    0,
    0,
    1,
    [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  ],
  [
    0,
    0,
    -1,
    [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  ],
]

export interface FaceArrays {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
  color: Float32Array
  index: Uint32Array
  quads: number
}

/** The distance between two block centres, in the expression's −1..1. */
export const stepOf = (size: number): number => (size > 1 ? 2 / (size - 1) : 2)

/**
 * The exposed faces of `shown` as quads, each block one of the palette's colours.
 *
 * Which block a position gets is a hash of the position, so it holds still while
 * everything else changes, and the shares come out at the pattern's chances. Each
 * block's colour is varied by a few percent so a wall of one block reads as blocks.
 */
export function faceArrays(
  shown: Uint8Array,
  size: number,
  palette: readonly Swatch[],
): FaceArrays | null {
  const S = size
  const S2 = S * S
  const on = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= S || y >= S || z >= S ? 0 : shown[x + y * S + z * S2]!

  let quads = 0
  for (let z = 0; z < S; z++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!shown[x + y * S + z * S2]) continue
        for (const [dx, dy, dz] of FACES) if (!on(x + dx, y + dy, z + dz)) quads++
      }
  if (quads === 0) return null

  const step = stepOf(S)
  const h = step / 2
  const position = new Float32Array(quads * 12)
  const normal = new Float32Array(quads * 12)
  const uv = new Float32Array(quads * 8)
  const color = new Float32Array(quads * 12)
  const index = new Uint32Array(quads * 6)
  const total = palette.reduce((sum, s) => sum + s.weight, 0)
  const c = new Color()
  let q = 0
  for (let z = 0; z < S; z++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!shown[x + y * S + z * S2]) continue
        const hash = positionHash(x, y, z)
        c.copy(pick(palette, ((hash % 1000) / 1000) * total).colour)
        c.multiplyScalar(0.94 + (((hash >>> 10) % 100) / 100) * 0.1)
        const cx = -1 + x * step - h
        const cy = -1 + y * step - h
        const cz = -1 + z * step - h
        for (const [dx, dy, dz, corners] of FACES) {
          if (on(x + dx, y + dy, z + dz)) continue
          for (let k = 0; k < 4; k++) {
            const o = q * 12 + k * 3
            const v = corners[k]!
            position[o] = cx + v[0]! * step
            position[o + 1] = cy + v[1]! * step
            position[o + 2] = cz + v[2]! * step
            normal.set([dx, dy, dz], o)
            color.set([c.r, c.g, c.b], o)
          }
          uv.set([0, 0, 0, 1, 1, 1, 1, 0], q * 8)
          const b = q * 4
          index.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6)
          q++
        }
      }
  return { position, normal, uv, color, index, quads }
}

function positionHash(x: number, y: number, z: number): number {
  const h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791)
  return (h ^ (h >>> 13)) >>> 0
}

function pick(palette: readonly Swatch[], at: number): Swatch {
  let left = at
  for (const swatch of palette) {
    if (left < swatch.weight) return swatch
    left -= swatch.weight
  }
  return palette[palette.length - 1]!
}

/** Wireframe: each exposed face's outline as line segments, no diagonals, in its colour. */
export function faceOutlines(arrays: FaceArrays): { position: Float32Array; color: Float32Array } {
  const n = arrays.quads
  const position = new Float32Array(n * 24)
  const color = new Float32Array(n * 24)
  for (let q = 0; q < n; q++)
    for (let k = 0; k < 4; k++) {
      const a = q * 12 + k * 3
      const b = q * 12 + ((k + 1) % 4) * 3
      const o = q * 24 + k * 6
      position.set(arrays.position.subarray(a, a + 3), o)
      position.set(arrays.position.subarray(b, b + 3), o + 3)
      color.set(arrays.color.subarray(a, a + 3), o)
      color.set(arrays.color.subarray(b, b + 3), o + 3)
    }
  return { position, color }
}

/** Which half Cutaway hides: the one nearer the camera, along whichever level axis faces it. */
export interface Cut {
  axis: 'x' | 'z'
  sign: 1 | -1
}

export function cutFacing(camera: { x: number; z: number }): Cut {
  const axis = Math.abs(camera.x) > Math.abs(camera.z) ? 'x' : 'z'
  return { axis, sign: (axis === 'x' ? camera.x : camera.z) < 0 ? -1 : 1 }
}

/** The blocks with the cut half taken away. The middle layer, at an odd size, stays. */
export function cutAway(filled: Uint8Array, size: number, cut: Cut | null): Uint8Array {
  if (cut === null) return filled
  const S = size
  const S2 = S * S
  const half = (S - 1) / 2
  const shown = new Uint8Array(filled.length)
  for (let z = 0; z < S; z++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = x + y * S + z * S2
        if (!filled[i]) continue
        const v = (cut.axis === 'x' ? x : z) - half
        if (v * cut.sign > 0.01) continue
        shown[i] = 1
      }
  return shown
}
