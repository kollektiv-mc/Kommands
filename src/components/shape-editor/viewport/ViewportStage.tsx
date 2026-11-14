import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  EdgesGeometry,
  MOUSE,
  Object3D,
  Vector3,
  type InstancedMesh,
  type PerspectiveCamera,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { VoxelField } from '../../../previews/worldedit/shape/voxels'
import { tokenColor } from '../../../previews/worldedit/shape/color'

/**
 * The shape editor's 3D view: the blocks the command places, inside the selection box.
 *
 * Its own canvas rather than `<PreviewStage>`'s, because the editor's camera is
 * driven by hand and the command sheet's turntable must never be. It is still the only
 * canvas on screen: the sheet's preview is unmounted while the editor is open.
 *
 * The canvas fills the editor behind its tiles, and the camera is framed on the
 * opening between them (`Frame`).
 *
 * Arrives through one dynamic import from `Viewport.tsx`, so Three.js stays out of the
 * entry chunk.
 */

const HOME = new Vector3(3.1, 2.3, 3.7)
const FOV = 34
const WIDE_FOV = 52

export default function ViewportStage({
  field,
  homeKey,
  opening,
}: {
  field: VoxelField | null
  /** Changing it sends the camera home. */
  homeKey: number
  /** The gap between the tiles, which the camera is framed on. */
  opening: RefObject<HTMLElement | null>
}) {
  return (
    <Canvas
      // Manual, so the projection `Frame` sets is not replaced on the next resize.
      camera={{ position: HOME.toArray(), fov: FOV, near: 0.02, far: 100, manual: true }}
      onContextMenu={(e) => e.preventDefault()}
      // Measured by layout size rather than drawn size: the editor opens and closes by
      // scaling the view, and a canvas sized to a frame of that would keep the size it
      // had mid-flight, since a transform never fires the resize observer again.
      resize={{ offsetSize: true }}
      // Kept so Done can take a picture of the view to close into the sheet with.
      gl={{ preserveDrawingBuffer: true }}
      className="touch-none"
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} />
      <Frame homeKey={homeKey} opening={opening} />
      <Controls homeKey={homeKey} />
      {field !== null && field.count > 0 && <Blocks field={field} />}
      <SelectionBox size={field?.size ?? 32} />
    </Canvas>
  )
}

/**
 * Frames the camera on the opening rather than on the whole canvas.
 *
 * The canvas is the editor's full area, but the build belongs in the gap between the
 * tiles. A view offset draws the frame the opening had as the canvas's matching part,
 * so the build is centred there and the rest of the canvas shows what lies around it.
 *
 * The frame is taken when the camera goes home and kept until it next does: resizing
 * the window then uncovers or hides the view's edges instead of re-zooming it under
 * the pointer. A frame taller than wide gets a wider lens, so a narrow window still
 * shows the whole build.
 */
function Frame({ homeKey, opening }: { homeKey: number; opening: RefObject<HTMLElement | null> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const frame = useRef<{ key: number; rect: DOMRect } | null>(null)

  useLayoutEffect(() => {
    const hole = opening.current
    if (hole === null) return
    if (frame.current?.key !== homeKey)
      frame.current = { key: homeKey, rect: hole.getBoundingClientRect() }
    const f = frame.current.rect
    const w = Math.max(1, f.width)
    const h = Math.max(1, f.height)
    const canvas = gl.domElement.getBoundingClientRect()
    camera.fov = w / h < 1 ? WIDE_FOV : FOV
    camera.aspect = w / h
    camera.setViewOffset(
      w,
      h,
      canvas.left - f.left,
      canvas.top - f.top,
      Math.max(1, canvas.width),
      Math.max(1, canvas.height),
    )
  }, [camera, gl, size, homeKey, opening])

  return null
}

/**
 * Left drag orbits, right drag zooms, middle drag pans.
 *
 * Three's orbit controls rather than a hand-written camera for now; the editor's own
 * rule, that each works about the point under the cursor, comes with the gizmo.
 */
function Controls({ homeKey }: { homeKey: number }) {
  const { camera, gl } = useThree()
  const controls = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.DOLLY }
    c.enableDamping = false
    c.minDistance = 0.4
    c.maxDistance = 20
    controls.current = c
    return () => c.dispose()
  }, [camera, gl])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    camera.position.copy(HOME)
    ;(camera as PerspectiveCamera).lookAt(0, 0, 0)
    c.target.set(0, 0, 0)
    c.update()
  }, [homeKey, camera])

  return null
}

/** The blocks, one instanced mesh for all of them, centred where WorldEdit puts them. */
function Blocks({ field }: { field: VoxelField }) {
  const mesh = useRef<InstancedMesh>(null)
  const color = useMemo(() => tokenColor('--accent-rgb'), [])
  // x, y and z run −1..1 across block centres, so a block is a little more than 2/size.
  const step = field.size > 1 ? 2 / (field.size - 1) : 2

  useLayoutEffect(() => {
    const instanced = mesh.current
    if (instanced === null) return
    const scratch = new Object3D()
    const { size, filled } = field
    let n = 0
    for (let iz = 0; iz < size; iz++) {
      for (let iy = 0; iy < size; iy++) {
        for (let ix = 0; ix < size; ix++) {
          if (filled[ix + iy * size + iz * size * size] !== 1) continue
          scratch.position.set(-1 + ix * step, -1 + iy * step, -1 + iz * step)
          scratch.updateMatrix()
          instanced.setMatrixAt(n++, scratch.matrix)
        }
      }
    }
    instanced.count = n
    instanced.instanceMatrix.needsUpdate = true
  }, [field, step])

  return (
    <instancedMesh ref={mesh} key={field.count} args={[undefined, undefined, field.count]}>
      <boxGeometry args={[step, step, step]} />
      <meshLambertMaterial color={color} />
    </instancedMesh>
  )
}

/** The selection's outline, on the outer faces of its outer blocks. */
function SelectionBox({ size }: { size: number }) {
  const half = 1 + (size > 1 ? 1 / (size - 1) : 1)
  const edges = useMemo(
    () => new EdgesGeometry(new BoxGeometry(half * 2, half * 2, half * 2)),
    [half],
  )
  const color = useMemo(() => tokenColor('--accent-rgb'), [])
  useEffect(() => () => edges.dispose(), [edges])
  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color={color} transparent opacity={0.25} />
    </lineSegments>
  )
}
