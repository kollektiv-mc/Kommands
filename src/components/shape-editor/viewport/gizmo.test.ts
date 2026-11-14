import { Group, Object3D } from 'three'
import { describe, expect, test } from 'vitest'
import { snapToBlocks, transformOf } from './gizmo'

describe('the gizmo', () => {
  test('a transform is kept rounded, in degrees', () => {
    const o = new Object3D()
    o.position.set(0.12345, -0.5, 1)
    o.rotation.set(Math.PI / 4, 0, -Math.PI / 2)
    o.scale.set(2.00049, 0.001, 1)
    expect(transformOf(o)).toEqual({ pos: [0.123, -0.5, 1], rot: [45, 0, -90], scl: [2, 0.01, 1] })
  })

  test('a move snaps to the block centres around it', () => {
    const root = new Group()
    const o = new Object3D()
    root.add(o)
    o.position.set(0.03, -0.97, 0.5)
    snapToBlocks(o, 0.5)
    expect(o.position.toArray()).toEqual([0, -1, 0.5])
  })

  test('inside a moved group, the snap is to world centres', () => {
    const root = new Group()
    const parent = new Group()
    parent.position.set(0.1, 0, 0)
    root.add(parent)
    const o = new Object3D()
    parent.add(o)
    o.position.set(0.3, 0, 0)
    snapToBlocks(o, 0.5)
    expect(o.getWorldPosition(o.position.clone()).x).toBeCloseTo(0.5)
    expect(o.position.x).toBeCloseTo(0.4)
  })

  test('an object with no parent stays put', () => {
    const o = new Object3D()
    o.position.set(0.3, 0, 0)
    snapToBlocks(o, 0.5)
    expect(o.position.x).toBe(0.3)
  })
})
