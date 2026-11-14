import { Box3, PerspectiveCamera, Ray, Vector3 } from 'three'
import { describe, expect, test } from 'vitest'
import { MAX_DISTANCE, ease, framing, grabPoint, orbitAround, panBy, zoomToward } from './camera'

const camera = () => {
  const c = new PerspectiveCamera(34, 1, 0.02, 100)
  c.position.set(0, 0, 4)
  c.lookAt(0, 0, 0)
  c.updateMatrixWorld()
  return c
}

describe('the camera', () => {
  test('an orbit keeps its distance from the pivot', () => {
    const c = camera()
    const target = new Vector3()
    const pivot = new Vector3(1, 0, 0)
    const before = c.position.distanceTo(pivot)
    orbitAround(c, target, pivot, Math.PI / 2, 0)
    expect(c.position.distanceTo(pivot)).toBeCloseTo(before)
    expect(target.distanceTo(pivot)).toBeCloseTo(1)
  })

  test('an orbit never tips over the top', () => {
    const c = camera()
    orbitAround(c, new Vector3(), new Vector3(), 0, -10)
    const forward = c.getWorldDirection(new Vector3())
    expect(Math.asin(forward.y)).toBeCloseTo(-1.5)
  })

  test('a zoom closes on the pivot and stops short of it', () => {
    const c = camera()
    const target = new Vector3()
    zoomToward(c, target, new Vector3(), 0.5)
    expect(c.position.z).toBeCloseTo(2)
    zoomToward(c, target, new Vector3(), 0)
    expect(c.position.z).toBeCloseTo(0.08)
  })

  test('a zoom out stops at the far limit', () => {
    const c = camera()
    c.position.set(0, 0, MAX_DISTANCE - 1)
    zoomToward(c, new Vector3(), new Vector3(), 2)
    expect(c.position.z).toBe(MAX_DISTANCE - 1)
  })

  test('a pan moves the camera and its target together', () => {
    const c = camera()
    const target = new Vector3()
    panBy(c, target, new Vector3(1, 0, 0), new Vector3(0, 0, 0))
    expect(c.position.x).toBe(1)
    expect(target.x).toBe(1)
  })

  test('a press grabs what it hits, else the depth of the build', () => {
    const c = camera()
    const ray = new Ray(new Vector3(0, 0, 4), new Vector3(0, 0, -1))
    const common = { ray, camera: c, target: new Vector3(), orbit: true }
    const hit = new Vector3(0, 0, 1)
    expect(grabPoint({ ...common, hit, centre: new Vector3() })).toEqual(hit)
    const at = grabPoint({ ...common, hit: null, centre: new Vector3(0, 0, -0.5) })
    expect(at.z).toBeCloseTo(-0.5)
  })

  test('with the build behind, a press lands on the floor or the camera', () => {
    const c = camera()
    const down = new Ray(new Vector3(0, 0, 4), new Vector3(0, -1, -1).normalize())
    const behind = new Vector3(0, 0, 10)
    const common = { camera: c, target: new Vector3(), hit: null, centre: behind }
    expect(grabPoint({ ...common, ray: down, orbit: true }).y).toBeCloseTo(-1)
    const up = new Ray(new Vector3(0, 0, 4), new Vector3(0, 1, 0))
    expect(grabPoint({ ...common, ray: up, orbit: true })).toEqual(c.position)
    expect(grabPoint({ ...common, ray: up, orbit: false }).y).toBeCloseTo(4)
  })

  test('framing a box looks from where the camera is', () => {
    const c = camera()
    const box = new Box3(new Vector3(1, 1, 1), new Vector3(2, 2, 2))
    const to = framing(box, c, new Vector3())!
    expect(to.target.toArray()).toEqual([1.5, 1.5, 1.5])
    expect(to.position.x).toBeCloseTo(1.5)
    expect(to.position.z).toBeGreaterThan(1.5)
    expect(framing(new Box3(), c, new Vector3())).toBeNull()
  })

  test('a glide eases in and out', () => {
    expect([ease(0), ease(0.5), ease(1)]).toEqual([0, 0.5, 1])
    expect(ease(0.25)).toBeLessThan(0.25)
  })
})
