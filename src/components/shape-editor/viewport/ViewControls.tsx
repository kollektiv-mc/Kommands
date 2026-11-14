import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { Box3, Vector3, type Color, type Group, type Mesh, type Object3D } from 'three'
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useShapeEditorStore } from '../../../stores/useShapeEditorStore'
import { HOME } from './blockMesh'
import { ease, framing } from './camera'
import { listenToPointer } from './viewPointer'

const GLIDE_MS = 450

interface Glide {
  from: Vector3
  to: Vector3
  fromTarget: Vector3
  toTarget: Vector3
  start: number
}

/**
 * The view's mouse: left drag orbits, middle drag pans, right drag and the wheel zoom,
 * all about the point under the cursor (`camera.ts`), with a dot on it while dragging.
 *
 * A left click picks the shape under the pointer, and a second click on the same spot
 * the one behind it; a click on nothing lets go of the selection. A right click on a
 * shape opens its menu. A press on Edit's gizmo is the gizmo's. Find glides the camera
 * to frame a layer, or the whole selection.
 */
export function ViewControls({
  homeKey,
  gizmo,
  blocks,
  world,
  objects,
  onMenu,
  pivotColour,
}: {
  homeKey: number
  gizmo: RefObject<TransformControls | null>
  blocks: RefObject<Mesh | null>
  world: RefObject<Group | null>
  objects: ReadonlyMap<string, Object3D>
  onMenu: (id: string, at: { x: number; y: number }) => void
  pivotColour: Color | undefined
}) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const target = useRef(new Vector3())
  const glide = useRef<Glide | null>(null)
  const dot = useRef<Mesh>(null)
  const finding = useShapeEditorStore((s) => s.finding)
  const seen = useRef(finding.n)
  const menu = useRef(onMenu)
  useEffect(() => {
    menu.current = onMenu
  }, [onMenu])

  useEffect(() => {
    glide.current = null
    camera.position.copy(HOME)
    camera.lookAt(0, 0, 0)
    target.current.set(0, 0, 0)
  }, [homeKey, camera])

  useEffect(() => {
    if (finding.n === seen.current) return
    seen.current = finding.n
    const o = finding.id === null ? undefined : objects.get(finding.id)
    const box =
      o === undefined
        ? new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))
        : new Box3().setFromObject(o)
    const to = framing(box, camera, target.current)
    if (to === null) return
    glide.current = {
      from: camera.position.clone(),
      to: to.position,
      fromTarget: target.current.clone(),
      toTarget: to.target,
      start: reducedMotion() ? -Infinity : performance.now(),
    }
  }, [finding, objects, camera])

  useFrame(() => {
    const g = glide.current
    if (g !== null) {
      const t = Math.min(1, (performance.now() - g.start) / GLIDE_MS)
      camera.position.lerpVectors(g.from, g.to, ease(t))
      target.current.lerpVectors(g.fromTarget, g.toTarget, ease(t))
      camera.lookAt(target.current)
      if (t === 1) glide.current = null
    }
    const d = dot.current
    if (d?.visible) d.scale.setScalar(camera.position.distanceTo(d.position) * 0.003)
  })

  useEffect(
    () =>
      listenToPointer({
        canvas: gl.domElement,
        camera,
        target: target.current,
        onGizmo: () => gizmo.current?.axis != null,
        blocks: () => blocks.current,
        world: () => world.current,
        dot: () => dot.current,
        stopGlide: () => {
          glide.current = null
        },
        onMenu: (id, at) => menu.current(id, at),
      }),
    [camera, gl, gizmo, blocks, world],
  )

  return (
    <mesh ref={dot} visible={false} renderOrder={20}>
      <sphereGeometry args={[1, 16, 10]} />
      <meshBasicMaterial color={pivotColour} depthTest={false} transparent opacity={0.95} />
    </mesh>
  )
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
