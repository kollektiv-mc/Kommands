import { Box3, MathUtils, Plane, Quaternion, Vector3, type Camera, type Ray } from 'three'

/**
 * The view's camera moves, each about a point: the one under the cursor when the drag
 * began, so what is grabbed stays under the hand.
 *
 * The camera is moved and turned directly; `target` is the point it is looking at, kept
 * only so a zoom with nothing under the cursor and a Find know how far away that is.
 */

const UP = new Vector3(0, 1, 0)
/** No zoom brings the camera nearer its pivot than this, or takes it further out. */
export const MIN_GAP = 0.08
export const MAX_DISTANCE = 14
/** The floor the build stands on, which a press beside the build lands on. */
const FLOOR = new Plane(UP, 1)

/** Turn the camera about `pivot`: `yaw` round the vertical, `pitch` over the top. */
export function orbitAround(
  camera: Camera,
  target: Vector3,
  pivot: Vector3,
  yaw: number,
  pitch: number,
) {
  const forward = camera.getWorldDirection(new Vector3())
  const elevation = Math.asin(MathUtils.clamp(forward.y, -1, 1))
  // Never past straight up or down, where the turn would flip the picture.
  const tilt = MathUtils.clamp(elevation + pitch, -1.5, 1.5) - elevation
  const right = new Vector3().crossVectors(forward, UP).normalize()
  const turn = new Quaternion()
    .setFromAxisAngle(UP, yaw)
    .multiply(new Quaternion().setFromAxisAngle(right, tilt))
  camera.position.sub(pivot).applyQuaternion(turn).add(pivot)
  target.sub(pivot).applyQuaternion(turn).add(pivot)
  camera.quaternion.premultiply(turn)
}

/** Move the camera toward `pivot` (`factor` below 1) or away from it (above 1). */
export function zoomToward(camera: Camera, target: Vector3, pivot: Vector3, factor: number) {
  const offset = camera.position.clone().sub(pivot)
  const distance = offset.length()
  if (distance === 0) return
  const next = pivot
    .clone()
    .addScaledVector(offset, Math.max(MIN_GAP, distance * factor) / distance)
  if (factor > 1 && next.length() > MAX_DISTANCE) return
  const by = next.sub(camera.position)
  camera.position.add(by)
  target.add(by)
}

/** Slide the camera so the point `from` on the drag's plane lands under `to`. */
export function panBy(camera: Camera, target: Vector3, from: Vector3, to: Vector3) {
  const by = from.clone().sub(to)
  camera.position.add(by)
  target.add(by)
}

/**
 * What a press pivots on: what is under the pointer; else the point under it as deep as
 * the build's centre; with that centre behind the camera, the floor within reach; and
 * failing all three, the camera itself for an orbit, so it turns on the spot, or a
 * point as far off as the target for a zoom or a pan.
 */
export function grabPoint({
  ray,
  hit,
  camera,
  target,
  centre,
  orbit,
}: {
  ray: Ray
  hit: Vector3 | null
  camera: Camera
  target: Vector3
  centre: Vector3
  orbit: boolean
}): Vector3 {
  if (hit !== null) return hit.clone()
  const forward = camera.getWorldDirection(new Vector3())
  const at = new Vector3()
  const ahead = centre.clone().sub(camera.position).dot(forward) > MIN_GAP
  if (ahead && ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(forward, centre), at))
    return at
  if (ray.intersectPlane(FLOOR, at) && at.distanceTo(camera.position) < MAX_DISTANCE) return at
  return orbit ? camera.position.clone() : ray.at(camera.position.distanceTo(target), at)
}

/**
 * Where the camera goes to frame a box: the same direction it looks from now, far enough
 * back that the box fills about half the view.
 */
export function framing(
  box: Box3,
  camera: Camera,
  target: Vector3,
  reach = 2.2,
): { position: Vector3; target: Vector3 } | null {
  if (box.isEmpty()) return null
  const centre = box.getCenter(new Vector3())
  const radius = Math.max(0.4, box.getSize(new Vector3()).length())
  const from = camera.position.clone().sub(target)
  const direction = from.lengthSq() > 0 ? from.normalize() : new Vector3(0, 0, 1)
  return { position: centre.clone().addScaledVector(direction, radius * reach), target: centre }
}

/** Slow in and out, for a glide. */
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
