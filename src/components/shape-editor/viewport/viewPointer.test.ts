import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useShapeEditorStore } from '../../../stores/useShapeEditorStore'
import { listenToPointer, type PointerOptions } from './viewPointer'

/** A 100 by 100 canvas, looking down z at two boxes, the nearer one `front`. */
function setUp(overrides: Partial<PointerOptions> = {}) {
  const canvas = document.createElement('div')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
  Object.defineProperty(canvas, 'clientHeight', { value: 100 })
  canvas.setPointerCapture = vi.fn()
  const camera = new PerspectiveCamera(34, 1, 0.02, 100)
  camera.position.set(0, 0, 4)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const world = new Group()
  const box = (id: string, z: number) => {
    const m = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshBasicMaterial())
    m.position.z = z
    m.userData = { pick: id }
    world.add(m)
  }
  box('front', 0.5)
  box('back', -0.5)
  world.updateMatrixWorld()
  const dot = new Mesh()
  const onMenu = vi.fn()
  const stop = listenToPointer({
    canvas,
    camera,
    target: new Vector3(),
    onGizmo: () => false,
    blocks: () => null,
    world: () => world,
    dot: () => dot,
    stopGlide: vi.fn(),
    onMenu,
    ...overrides,
  })
  const fire = (type: string, x: number, y: number, button = 0, extra: object = {}) => {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button, cancelable: true })
    Object.assign(event, { pointerId: 1, ...extra })
    canvas.dispatchEvent(event)
  }
  const click = (x: number, y: number, button = 0) => {
    fire('pointerdown', x, y, button)
    fire('pointerup', x, y, button)
  }
  return { canvas, camera, onMenu, fire, click, dot, stop }
}

const store = () => useShapeEditorStore.getState()

beforeEach(() => {
  store().load({ layers: [], pattern: 'stone', hollow: false, round: false })
})
afterEach(() => store().setDragging(false))

describe('the view under the pointer', () => {
  test('a click picks the nearest, again the one behind', () => {
    const { click } = setUp()
    click(50, 50)
    expect(store().selected).toBe('front')
    click(51, 50)
    expect(store().selected).toBe('back')
    click(50, 50)
    expect(store().selected).toBe('front')
  })

  test('a click on nothing lets go of the selection', () => {
    const { click } = setUp()
    click(50, 50)
    click(2, 2)
    expect(store().selected).toBeNull()
  })

  test('a right click opens the shape menu there', () => {
    const { click, onMenu } = setUp()
    click(50, 50, 2)
    expect(onMenu).toHaveBeenCalledWith('front', { x: 50, y: 50 })
    expect(store().selected).toBe('front')
    click(2, 2, 2)
    expect(onMenu).toHaveBeenCalledTimes(1)
  })

  test('a drag orbits about the grabbed point and picks nothing', () => {
    const { fire, camera, dot } = setUp()
    fire('pointerdown', 50, 50)
    fire('pointermove', 70, 50)
    expect(dot.visible).toBe(true)
    expect(dot.position.z).toBeCloseTo(0.75)
    fire('pointerup', 70, 50)
    expect(dot.visible).toBe(false)
    expect(camera.position.x).not.toBeCloseTo(0)
    expect(camera.position.distanceTo(new Vector3(0, 0, 0.75))).toBeCloseTo(3.25)
    expect(store().selected).toBeNull()
  })

  test('a right drag zooms and a middle drag pans', () => {
    const { fire, camera } = setUp()
    fire('pointerdown', 50, 50, 2)
    fire('pointermove', 50, 100, 2)
    fire('pointerup', 50, 100, 2)
    expect(camera.position.z).toBeLessThan(4)
    const z = camera.position.z
    fire('pointerdown', 50, 50, 1)
    fire('pointermove', 80, 50, 1)
    fire('pointerup', 80, 50, 1)
    expect(camera.position.x).toBeLessThan(0)
    expect(camera.position.z).toBeCloseTo(z)
  })

  test('the wheel zooms toward the pointer', () => {
    const { canvas, camera } = setUp()
    const wheel = new WheelEvent('wheel', {
      clientX: 50,
      clientY: 50,
      deltaY: -100,
      cancelable: true,
    })
    canvas.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    expect(camera.position.z).toBeLessThan(4)
  })

  test('a press on the gizmo, or during its drag, is left alone', () => {
    const { click, fire, camera } = setUp({ onGizmo: () => true })
    click(50, 50)
    expect(store().selected).toBeNull()
    store().setDragging(true)
    fire('pointerdown', 50, 50, 1)
    fire('pointermove', 90, 50, 1)
    expect(camera.position.x).toBe(0)
  })

  test('taking the listeners off stops it all', () => {
    const { click, stop } = setUp()
    stop()
    click(50, 50)
    expect(store().selected).toBeNull()
  })
})
