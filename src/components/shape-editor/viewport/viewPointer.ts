import {
  Box3,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Group,
  type Mesh,
  type Object3D,
} from 'three'
import { useShapeEditorStore } from '../../../stores/useShapeEditorStore'
import { find } from '../../../worldedit/stack/edit'
import { MIN_GAP, grabPoint, orbitAround, panBy, zoomToward } from './camera'
import { bendAngleToward } from './guides'

/** How far a press may wander and still be a click rather than a drag. */
const CLICK = 4
/** A second click this near the first reaches the shape behind. */
const AGAIN = 6

type Mode = 'orbit' | 'pan' | 'zoom'
const MODES: readonly (Mode | undefined)[] = ['orbit', 'pan', 'zoom']

interface Drag {
  mode: Mode
  button: number
  pivot: Vector3
  /** Pan's plane: through the pivot, facing the camera. */
  plane: Plane
  x: number
  y: number
  moved: boolean
  pointer: number
}

export interface PointerOptions {
  canvas: HTMLElement
  camera: Camera
  /** The point the camera looks at, moved with it. */
  target: Vector3
  /** Whether the pointer is over Edit's gizmo, whose press it is. */
  onGizmo: () => boolean
  /** The build's solid blocks, when they are drawn. */
  blocks: () => Mesh | null
  /** The layers, whose meshes carry `userData.pick`: the id a click on them selects. */
  world: () => Group | null
  /** The dot on the pivot while a drag lasts. */
  dot: () => Mesh | null
  stopGlide: () => void
  onMenu: (id: string, at: { x: number; y: number }) => void
}

/**
 * The view's mouse, on the canvas: left drag orbits, middle drag pans, right drag and the
 * wheel zoom, all about the point under the cursor (`camera.ts`).
 *
 * A left click picks the shape under the pointer, and a second click on the same spot
 * the one behind it; a click on nothing lets go of the selection. A right click on a
 * shape selects it and opens its menu. A left press on Edit's gizmo is the gizmo's,
 * and one on a selected Bend's handle drags its angle.
 * Returns what takes the listeners off again.
 */
export function listenToPointer({
  canvas,
  camera,
  target,
  onGizmo,
  blocks,
  world,
  dot,
  stopGlide,
  onMenu,
}: PointerOptions): () => void {
  const raycaster = new Raycaster()
  const aim = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect()
    const ndc = new Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    return raycaster
  }
  const pickables = () => {
    const out: Object3D[] = []
    world()?.traverse((o) => {
      if (typeof o.userData.pick === 'string') out.push(o)
    })
    return out
  }
  /** What is under the pointer, nearest first, as layer ids. */
  const idsAt = (e: PointerEvent) => [
    ...new Set(
      aim(e)
        .intersectObjects(pickables(), false)
        .map((h) => h.object.userData.pick),
    ),
  ]
  const grab = (e: PointerEvent | WheelEvent, mode: Mode) => {
    const ray = aim(e)
    const built = blocks()
    const solid = built?.userData.solid === true ? [built] : null
    const hits =
      solid === null
        ? ray.intersectObjects(pickables(), false)
        : ray.intersectObjects(
            [...solid, ...pickables().filter((o) => o.userData.solid === true)],
            false,
          )
    return grabPoint({
      ray: ray.ray,
      hit: hits[0]?.point ?? null,
      camera,
      target,
      centre: buildCentre(blocks(), world()),
      orbit: mode === 'orbit',
    })
  }

  const hideDot = () => {
    const d = dot()
    if (d !== null) d.visible = false
  }

  let drag: Drag | null = null
  let last = { x: -99, y: -99, ids: [] as unknown[], i: 0 }
  /** A selected Bend's handle being dragged: the modifier, its frame, and the plane it turns in. */
  let bending: { id: string; frame: Object3D; plane: Plane; pointer: number } | null = null

  /** A press on a Bend's handle starts dragging its angle. */
  const startBend = (e: PointerEvent): boolean => {
    const handles: Object3D[] = []
    world()?.traverse((o) => {
      if (typeof o.userData.bend === 'string') handles.push(o)
    })
    const hit = handles.length === 0 ? undefined : aim(e).intersectObjects(handles, false)[0]
    const frame = hit?.object.parent
    if (hit === undefined || frame === null || frame === undefined) return false
    const id = hit.object.userData.bend as string
    const layer = find(useShapeEditorStore.getState().layers, id)?.layer
    if (layer?.type !== 'modifier' || layer.kind !== 'bend') return false
    const { axis, toward } = layer.params
    const third = (['x', 'y', 'z'] as const).find((a) => a !== axis && a !== toward) ?? 'z'
    const normal = new Vector3(third === 'x' ? 1 : 0, third === 'y' ? 1 : 0, third === 'z' ? 1 : 0)
    normal.transformDirection(frame.matrixWorld)
    const through = frame.getWorldPosition(new Vector3())
    bending = {
      id,
      frame,
      plane: new Plane().setFromNormalAndCoplanarPoint(normal, through),
      pointer: e.pointerId,
    }
    canvas.setPointerCapture(e.pointerId)
    return true
  }
  const moveBend = (e: PointerEvent, b: NonNullable<typeof bending>) => {
    const at = aim(e).ray.intersectPlane(b.plane, new Vector3())
    if (at === null) return
    const local = b.frame.worldToLocal(at)
    const store = useShapeEditorStore.getState()
    store.change(
      b.id,
      (l) => {
        if (l.type !== 'modifier' || l.kind !== 'bend') return l
        const angle = bendAngleToward(l.params, [local.x, local.y, local.z], store.edit.snap)
        return angle === l.params.angle ? l : { ...l, params: { ...l.params, angle } }
      },
      'bend',
    )
  }

  const onDown = (e: PointerEvent) => {
    const mode = MODES[e.button]
    if (mode === undefined) return
    if (e.button === 0 && onGizmo()) return
    if (e.button === 0 && startBend(e)) return
    if (e.button === 1) e.preventDefault()
    stopGlide()
    const pivot = grab(e, mode)
    drag = {
      mode,
      button: e.button,
      pivot,
      plane: new Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new Vector3()),
        pivot,
      ),
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointer: e.pointerId,
    }
  }
  const onMove = (e: PointerEvent) => {
    if (bending !== null && e.pointerId === bending.pointer) {
      moveBend(e, bending)
      return
    }
    if (drag === null || e.pointerId !== drag.pointer) return
    if (useShapeEditorStore.getState().dragging) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < CLICK) return
      drag.moved = true
      canvas.setPointerCapture(e.pointerId)
      const d = dot()
      if (d !== null) {
        d.position.copy(drag.pivot)
        d.visible = drag.pivot.distanceTo(camera.position) > MIN_GAP
      }
    }
    drag.x = e.clientX
    drag.y = e.clientY
    const h = canvas.clientHeight || 1
    if (drag.mode === 'orbit') {
      orbitAround(camera, target, drag.pivot, (-2 * Math.PI * dx) / h, (-2 * Math.PI * dy) / h)
    } else if (drag.mode === 'zoom') {
      zoomToward(camera, target, drag.pivot, Math.exp(-dy * 0.006))
    } else {
      const at = aim(e).ray.intersectPlane(drag.plane, new Vector3())
      if (at !== null) panBy(camera, target, drag.pivot, at)
    }
  }
  const onUp = (e: PointerEvent) => {
    if (bending !== null && e.pointerId === bending.pointer) {
      bending = null
      useShapeEditorStore.getState().settle()
      return
    }
    if (drag === null || e.pointerId !== drag.pointer) return
    const ended = drag
    drag = null
    hideDot()
    if (ended.moved) return
    const store = useShapeEditorStore.getState()
    if (ended.button === 0 && !store.dragging) {
      const ids = idsAt(e)
      if (ids.length === 0) {
        store.select(null)
        return
      }
      const again =
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < AGAIN && ids.join() === last.ids.join()
      const i = again ? (last.i + 1) % ids.length : 0
      last = { x: e.clientX, y: e.clientY, ids, i }
      store.select(ids[i] as string)
    } else if (ended.button === 2) {
      const [id] = idsAt(e)
      if (typeof id !== 'string') return
      store.select(id)
      onMenu(id, { x: e.clientX, y: e.clientY })
    }
  }
  const onCancel = () => {
    if (bending !== null) useShapeEditorStore.getState().settle()
    bending = null
    drag = null
    hideDot()
  }

  let wheel: { pivot: Vector3; x: number; y: number; t: number } | null = null
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    stopGlide()
    const now = performance.now()
    if (
      wheel === null ||
      now - wheel.t > 250 ||
      Math.hypot(e.clientX - wheel.x, e.clientY - wheel.y) > 3
    )
      wheel = { pivot: grab(e, 'zoom'), x: e.clientX, y: e.clientY, t: now }
    wheel.t = now
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    zoomToward(camera, target, wheel.pivot, Math.exp(Math.max(-120, Math.min(120, dy)) * 0.0018))
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onCancel)
    canvas.removeEventListener('wheel', onWheel)
  }
}

/** The middle of what is built: its blocks when they are drawn, else its shapes, else the origin. */
function buildCentre(blocks: Mesh | null, world: Group | null): Vector3 {
  if (blocks !== null) {
    const geometry = blocks.geometry
    if (geometry.boundingBox === null) geometry.computeBoundingBox()
    if (geometry.boundingBox !== null) return geometry.boundingBox.getCenter(new Vector3())
  }
  const box = world === null ? new Box3() : new Box3().setFromObject(world)
  return box.isEmpty() ? new Vector3() : box.getCenter(new Vector3())
}
