import { Vector3, type Object3D } from 'three'
import type { Vec3 } from '../../../worldedit/stack/layers'

const DEG = Math.PI / 180

/**
 * What the gizmo has done to a layer's object, as the layer keeps it: a position to
 * three places, a turn in degrees to one, a scale to three and never below 0.01.
 */
export function transformOf(o: Object3D): { pos: Vec3; rot: Vec3; scl: Vec3 } {
  return {
    pos: each(o.position, round(3)),
    rot: each(o.rotation, (r) => round(1)(r / DEG)),
    scl: each(o.scale, (v) => Math.max(0.01, round(3)(v))),
  }
}

/**
 * An object moved onto the nearest block centre, wherever its parents put it, so a shape
 * lands where the blocks it places will be. Block centres run from −1 in steps of
 * `step`, which is 2 / (size − 1).
 */
export function snapToBlocks(o: Object3D, step: number) {
  const parent = o.parent
  if (parent === null) return
  const at = o.getWorldPosition(new Vector3())
  const centre = (v: number) => -1 + Math.round((v + 1) / step) * step
  at.set(centre(at.x), centre(at.y), centre(at.z))
  o.position.copy(parent.worldToLocal(at))
}

const each = (v: { x: number; y: number; z: number }, f: (n: number) => number): Vec3 => [
  f(v.x),
  f(v.y),
  f(v.z),
]

const round = (digits: number) => (v: number) => {
  const k = 10 ** digits
  return Math.round(v * k) / k
}
