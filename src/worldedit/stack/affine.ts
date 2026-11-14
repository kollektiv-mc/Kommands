import { turn, type Affine } from '../csg'
import type { Vec3 } from './layers'

/**
 * A layer's placement as the `affine` node its child is asked through.
 *
 * The node maps a point in the parent into the layer's own space, so it is the inverse
 * of the placement: for `M = T·R·S` it holds `S⁻¹·Rᵀ` and `−S⁻¹·Rᵀ·t`. Composing it here
 * is what makes a turned, moved and scaled shape one linear form per coordinate in the
 * command rather than six nested ones.
 *
 * Coefficients are kept to twelve significant digits. A product of two cosines is never
 * exactly what anyone meant, and the noise in its last digits would otherwise be written
 * into the command, which reads it back as a different number anyway at 128³.
 */

const DEG = Math.PI / 180
type Matrix3 = readonly [number, number, number, number, number, number, number, number, number]

const multiply = (a: Matrix3, b: Matrix3): Matrix3 => {
  const at = (r: number, c: number): number =>
    a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!
  return [at(0, 0), at(0, 1), at(0, 2), at(1, 0), at(1, 1), at(1, 2), at(2, 0), at(2, 1), at(2, 2)]
}

/** Three's XYZ Euler order: `Rx·Ry·Rz`, so z turns first. */
export function rotation(degrees: Vec3): Matrix3 {
  const [x, y, z] = degrees.map((d) => turn(d * DEG))
  const rx: Matrix3 = [1, 0, 0, 0, x!.cos, -x!.sin, 0, x!.sin, x!.cos]
  const ry: Matrix3 = [y!.cos, 0, y!.sin, 0, 1, 0, -y!.sin, 0, y!.cos]
  const rz: Matrix3 = [z!.cos, -z!.sin, 0, z!.sin, z!.cos, 0, 0, 0, 1]
  return multiply(multiply(rx, ry), rz)
}

const transpose = (m: Matrix3): Matrix3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]

export function tidy(value: number): number {
  if (Math.abs(value) < 1e-12) return 0
  return Number(value.toPrecision(12))
}

/** The inverse of placing something at `pos`, turned by `rot` and scaled by `scl`. */
export function placementInverse(pos: Vec3, rot: Vec3, scl: Vec3): Affine {
  const t = transpose(rotation(rot))
  // S⁻¹·Rᵀ: each row of Rᵀ divided by that axis's scale.
  const a = (r: number, c: number): number => t[r * 3 + c]! / scl[r]!
  const offset = (r: number): number => -(a(r, 0) * pos[0] + a(r, 1) * pos[1] + a(r, 2) * pos[2])
  const row = (r: number): [number, number, number, number] => [
    tidy(a(r, 0)),
    tidy(a(r, 1)),
    tidy(a(r, 2)),
    tidy(offset(r)),
  ]
  return [...row(0), ...row(1), ...row(2)]
}

/** The placement itself, `T·R` with no scale, for putting a modifier's frame back. */
export function placement(pos: Vec3, rot: Vec3): Affine {
  const r = rotation(rot)
  const row = (i: 0 | 1 | 2): [number, number, number, number] => [
    tidy(r[i * 3]!),
    tidy(r[i * 3 + 1]!),
    tidy(r[i * 3 + 2]!),
    tidy(pos[i]),
  ]
  return [...row(0), ...row(1), ...row(2)]
}

export const isTurned = (rot: Vec3): boolean => rot.some((d) => d % 360 !== 0)
export const isScaled = (scl: Vec3): boolean => scl.some((s) => s !== 1)
export const isMoved = (pos: Vec3): boolean => pos.some((v) => v !== 0)
