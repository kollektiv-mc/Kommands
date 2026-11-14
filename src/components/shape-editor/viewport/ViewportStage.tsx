import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  EdgesGeometry,
  GridHelper,
  Plane,
  Vector3,
  type Color,
  type Group,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import type { VoxelField } from '../../../previews/worldedit/shape/voxels'
import { cssToken, tokenColor, tokenCssColor } from '../../../previews/worldedit/shape/color'
import { useShapeEditorStore, type ViewOptions } from '../../../stores/useShapeEditorStore'
import type { Layer, Op, ReferenceLayer, ShapeLayer } from '../../../worldedit/stack/layers'
import { pivotOf } from '../../../worldedit/stack/lower'
import { HOME, blockTexture, faceGeometry, outlineGeometry } from './blockMesh'
import {
  blockColour,
  blockPalette,
  cutAway,
  cutFacing,
  faceArrays,
  stepOf,
  type Cut,
} from './faces'
import { ghostOf, ghostOpacity } from './ghosts'
import { ModifierGuide } from './ModifierGuide'
import { Gizmo } from './Gizmo'
import type { ReferenceVoxels } from './useReferenceVoxels'
import { ViewControls } from './ViewControls'

/**
 * The shape editor's 3D view: the blocks the command places, inside the selection box,
 * and around them what the View menu asks for.
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

const FOV = 34
const WIDE_FOV = 52
const DEG = Math.PI / 180

export interface StageProps {
  field: VoxelField | null
  /** The blocks the build is made of, which colour it. */
  pattern: string
  /** What the view shows: every layer, or the isolated one. */
  layers: readonly Layer[]
  /** Each Reference's blocks, by its command. */
  references: ReadonlyMap<string, ReferenceVoxels>
  /** Samples per axis, which sets where the floor and the box sit. */
  size: number
  /** Changing it sends the camera home. */
  homeKey: number
  /** The gap between the tiles, which the camera is framed on. */
  opening: RefObject<HTMLElement | null>
  /** A right-click on a layer: that layer's menu. */
  onMenu: (id: string, at: { x: number; y: number }) => void
}

export default function ViewportStage(props: StageProps) {
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
      // Local clipping is what lets Cutaway cut the outlines as well as the blocks.
      gl={{ preserveDrawingBuffer: true, localClippingEnabled: true }}
      className="touch-none"
    >
      <Scene {...props} />
    </Canvas>
  )
}

function Scene({ field, pattern, layers, references, size, homeKey, opening, onMenu }: StageProps) {
  const view = useShapeEditorStore((s) => s.view)
  const selected = useShapeEditorStore((s) => s.selected)
  const editing = useShapeEditorStore((s) => s.edit.on)
  const colours = useColours()
  const gizmo = useRef<TransformControls | null>(null)
  const holdGizmo = useCallback((c: TransformControls | null) => {
    gizmo.current = c
  }, [])
  const blocks = useRef<Mesh | null>(null)
  const world = useRef<Group>(null)
  // Each drawn layer's object, by id: what the gizmo takes hold of and Find frames.
  const objects = useMemo(() => new Map<string, Object3D>(), [])
  const cut = useCut(view.cutaway)
  const clip = useMemo(() => clipFor(cut), [cut])
  // The outer blocks reach half a block past ±1: the box, floor and figure sit there.
  const ground = 1 + stepOf(size) / 2

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} />
      <Frame homeKey={homeKey} opening={opening} />
      <ViewControls
        homeKey={homeKey}
        gizmo={gizmo}
        blocks={blocks}
        world={world}
        objects={objects}
        onMenu={onMenu}
        pivotColour={colours.op.add}
      />
      {view.show === 'blocks' && field !== null && field.count > 0 && (
        <Blocks
          field={field}
          pattern={pattern}
          view={view}
          cut={cut}
          solid={colours.solid}
          mesh={blocks}
        />
      )}
      <group ref={world}>
        <LayerTree
          layers={layers}
          context={{ selected, editing, view, clip, colours, references, size, objects }}
        />
      </group>
      <Gizmo layers={layers} objects={objects} onControls={holdGizmo} size={size} />
      {view.bounds && <SelectionBox half={ground} colour={colours.line} />}
      {view.grid && <Grid half={ground} colour={colours.line} />}
      {view.axes && <Axes half={ground} />}
      {view.player && <Player step={stepOf(size)} ground={ground} colour={colours.figure} />}
    </>
  )
}

interface Colours {
  op: Record<Op, Color | undefined>
  line: Color | undefined
  reference: Color | undefined
  modifier: Color | undefined
  figure: Color | undefined
  /** Solid shading's one colour: smooth stone, a neutral grey with a block's own grain. */
  solid: Color
}

/** The scene's colours, read from the token layer once the canvas is up. */
function useColours(): Colours {
  return useMemo(
    () => ({
      op: {
        add: tokenColor('--accent-rgb'),
        cut: tokenColor('--danger-rgb'),
        overlap: tokenColor('--warning-rgb'),
      },
      line: tokenCssColor('--text-primary'),
      // References, modifiers and the figure have no colour of their own yet; see
      // docs/health-checklist.md, Open backlog.
      reference: tokenCssColor('--text-secondary'),
      modifier: tokenCssColor('--text-secondary'),
      figure: tokenCssColor('--text-muted'),
      solid: blockColour('smooth_stone'),
    }),
    [],
  )
}

/**
 * Which half Cutaway hides, following the camera. It only changes at the diagonals,
 * so the blocks are rebuilt once per change of side rather than every frame.
 */
function useCut(on: boolean): Cut | null {
  const camera = useThree((s) => s.camera)
  const [cut, setCut] = useState<Cut | null>(null)
  useFrame(() => {
    if (!on) return
    const next = cutFacing(camera.position)
    if (cut === null || next.axis !== cut.axis || next.sign !== cut.sign) setCut(next)
  })
  return on ? cut : null
}

function clipFor(cut: Cut | null): Plane[] {
  if (cut === null) return []
  const normal = new Vector3(cut.axis === 'x' ? -cut.sign : 0, 0, cut.axis === 'z' ? -cut.sign : 0)
  return [new Plane(normal, 0)]
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

/** The block texture, made once for this canvas and let go with it. */
function useBlockTexture(): CanvasTexture | null {
  const texture = useMemo(() => blockTexture(), [])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

/** One geometry for a set of blocks, in whichever shading the view asks for. */
function useBlockGeometry(
  filled: Uint8Array,
  size: number,
  pattern: string,
  wire: boolean,
): BufferGeometry | null {
  const geometry = useMemo(() => {
    const arrays = faceArrays(filled, size, blockPalette(pattern))
    if (arrays === null) return null
    return wire ? outlineGeometry(arrays) : faceGeometry(arrays)
  }, [filled, size, pattern, wire])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry
}

/** The build's blocks: only their outer faces, coloured from the pattern. */
function Blocks({
  field,
  pattern,
  view,
  cut,
  solid,
  mesh,
}: {
  field: VoxelField
  pattern: string
  view: ViewOptions
  cut: Cut | null
  solid: Color
  /** The solid blocks, which a press on the view grabs; empty while drawn as lines. */
  mesh: RefObject<Mesh | null>
}) {
  const shown = useMemo(() => cutAway(field.filled, field.size, cut), [field, cut])
  const wire = view.shading === 'wire'
  const geometry = useBlockGeometry(shown, field.size, pattern, wire)
  const texture = useBlockTexture()
  if (geometry === null) return null
  if (wire) {
    return (
      <lineSegments geometry={geometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.75} />
      </lineSegments>
    )
  }
  const coloured = view.shading === 'coloured'
  return (
    <mesh ref={mesh} geometry={geometry} userData={{ solid: !view.xray }}>
      <meshLambertMaterial
        key={`${view.shading}-${view.xray}`}
        map={texture}
        vertexColors={coloured}
        color={coloured ? undefined : solid}
        transparent={view.xray}
        opacity={view.xray ? 0.28 : 1}
        depthWrite={!view.xray}
      />
    </mesh>
  )
}

interface TreeContext {
  selected: string | null
  editing: boolean
  view: ViewOptions
  clip: Plane[]
  colours: Colours
  references: ReadonlyMap<string, ReferenceVoxels>
  size: number
  objects: Map<string, Object3D>
}

/**
 * The layers as the view draws them: each in its parent's frame, as the compiler
 * places it. Hidden layers and everything inside a hidden group are left out.
 * A modifier draws its guide.
 */
function LayerTree({ layers, context }: { layers: readonly Layer[]; context: TreeContext }) {
  return (
    <>
      {layers.map((layer) =>
        layer.visible ? (
          <group
            key={layer.id}
            ref={(o) => {
              if (o === null) return
              context.objects.set(layer.id, o)
              return () => {
                if (context.objects.get(layer.id) === o) context.objects.delete(layer.id)
              }
            }}
            // A modifier sits where it works about, which is not always all of its
            // position, and never scales.
            position={layer.type === 'modifier' ? pivotOf(layer) : layer.pos}
            rotation={[layer.rot[0] * DEG, layer.rot[1] * DEG, layer.rot[2] * DEG]}
            scale={layer.type === 'modifier' ? 1 : layer.scl}
          >
            {layer.type === 'group' ? (
              <>
                {/* In Edit, a selected group shows its own space, which moves, turns
                    and scales with it. */}
                {context.editing && context.selected === layer.id && (
                  <SelectionBox half={1} colour={context.colours.op.add} opacity={0.45} />
                )}
                <LayerTree layers={layer.children} context={context} />
              </>
            ) : layer.type === 'reference' ? (
              <ReferenceBlocks layer={layer} context={context} />
            ) : layer.type === 'modifier' ? (
              <ModifierGuide
                layer={layer}
                selected={context.selected === layer.id}
                colour={context.colours.modifier}
                clip={context.clip}
              />
            ) : (
              <ShapeGhost layer={layer} context={context} />
            )}
          </group>
        ) : null,
      )}
    </>
  )
}

function ShapeGhost({ layer, context }: { layer: ShapeLayer; context: TreeContext }) {
  const { kind, params } = layer
  // Rebuilt only when the shape's own size changes, never when it moves.
  const ghost = useMemo(
    () => ghostOf({ ...layer, params } as ShapeLayer),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what the outline is made of
    [kind, JSON.stringify(params)],
  )
  useEffect(
    () => () => {
      ghost?.solid?.dispose()
      ghost?.lines.dispose()
    },
    [ghost],
  )
  if (ghost === null) return null
  const opacity = ghostOpacity(layer, ghost, {
    selected: context.selected === layer.id,
    shapes: context.view.show === 'shapes',
  })
  const colour = context.colours.op[layer.op]
  return (
    <>
      {/* Drawn or not, the body is what a click on the view picks the shape by. */}
      {ghost.solid !== null && (
        <mesh
          geometry={ghost.solid}
          renderOrder={2}
          visible={opacity.solid > 0}
          userData={{ pick: layer.id }}
        >
          <meshBasicMaterial
            color={colour}
            transparent
            depthWrite={false}
            side={DoubleSide}
            opacity={opacity.solid}
            clippingPlanes={context.clip}
          />
        </mesh>
      )}
      {opacity.lines > 0 && (
        <lineSegments geometry={ghost.lines} renderOrder={3}>
          <lineBasicMaterial
            color={colour}
            transparent
            depthWrite={false}
            opacity={opacity.lines}
            clippingPlanes={context.clip}
          />
        </lineSegments>
      )}
    </>
  )
}

/**
 * A Reference: another command's blocks, drawn see-through in the same shading as the
 * build's own, where the layer puts them. Selected, it also shows its own box.
 */
function ReferenceBlocks({ layer, context }: { layer: ReferenceLayer; context: TreeContext }) {
  const voxels = context.references.get(layer.command)
  const selected = context.selected === layer.id
  const ready = voxels?.state === 'ready' ? voxels : null
  const empty = useMemo(() => new Uint8Array(1), [])
  const wire = context.view.shading === 'wire'
  const geometry = useBlockGeometry(
    ready?.field.filled ?? empty,
    ready?.field.size ?? 1,
    ready?.pattern ?? '',
    wire,
  )
  const texture = useBlockTexture()
  const half = 1 + stepOf(context.size) / 2
  const opacity = selected ? 0.7 : 0.5
  return (
    <>
      {selected && context.view.bounds && (
        <SelectionBox half={half} colour={context.colours.reference} opacity={0.45} />
      )}
      {ready !== null &&
        geometry !== null &&
        (wire ? (
          <lineSegments geometry={geometry} renderOrder={1}>
            <lineBasicMaterial
              vertexColors
              transparent
              depthWrite={false}
              opacity={selected ? 0.9 : 0.6}
              clippingPlanes={context.clip}
            />
          </lineSegments>
        ) : (
          <mesh geometry={geometry} renderOrder={1} userData={{ pick: layer.id, solid: true }}>
            <meshLambertMaterial
              key={context.view.shading}
              map={texture}
              vertexColors={context.view.shading === 'coloured'}
              color={context.view.shading === 'coloured' ? undefined : context.colours.solid}
              transparent
              depthWrite={false}
              opacity={opacity}
              clippingPlanes={context.clip}
            />
          </mesh>
        ))}
    </>
  )
}

/** The selection's outline, on the outer faces of its outer blocks. */
function SelectionBox({
  half,
  colour,
  opacity = 0.14,
}: {
  half: number
  colour: Color | undefined
  opacity?: number
}) {
  const edges = useMemo(() => {
    const box = new BoxGeometry(half * 2, half * 2, half * 2)
    const lines = new EdgesGeometry(box)
    box.dispose()
    return lines
  }, [half])
  useEffect(() => () => edges.dispose(), [edges])
  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color={colour} transparent opacity={opacity} />
    </lineSegments>
  )
}

/** The floor: sixteen squares across the selection, under its lowest blocks. */
function Grid({ half, colour }: { half: number; colour: Color | undefined }) {
  const grid = useMemo(() => {
    const g = new GridHelper(half * 2, 16, colour, colour)
    g.position.y = -half
    const material = Array.isArray(g.material) ? g.material : [g.material]
    for (const m of material) {
      m.transparent = true
      m.opacity = 0.1
      m.depthWrite = false
    }
    return g
  }, [half, colour])
  useEffect(() => () => grid.dispose(), [grid])
  return <primitive object={grid} />
}

const AXES = [
  { to: [1, 0, 0], token: '--danger', text: '+x east', past: 0.08 },
  { to: [0, 1, 0], token: '--success', text: '+y up', past: 0.1 },
  // z has no colour token yet; see docs/health-checklist.md, Open backlog.
  { to: [0, 0, 1], token: '--text-secondary', text: '+z south', past: 0.1 },
] as const

/**
 * The three axes from the selection's low corner, each named by its compass direction
 * in Minecraft, where +x is east and +z is south.
 */
function Axes({ half }: { half: number }) {
  return (
    <group position={[-half, -half, -half]}>
      {AXES.map((axis) => (
        <Axis key={axis.text} {...axis} half={half} />
      ))}
    </group>
  )
}

function Axis({
  to,
  token,
  text,
  past,
  half,
}: {
  to: readonly [number, number, number]
  token: string
  text: string
  /** How far beyond the axis's end the label starts, in the selection's units. */
  past: number
  half: number
}) {
  const line = useMemo(() => {
    const end = to.map((v) => v * half * 2)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, ...end]), 3))
    return g
  }, [to, half])
  const label = useMemo(() => labelTexture(text, cssToken(token)), [text, token])
  useEffect(
    () => () => {
      line.dispose()
      label?.dispose()
    },
    [line, label],
  )
  const colour = useMemo(() => tokenCssColor(token), [token])
  const at = to.map((v) => v * (half * 2 + past * half)) as [number, number, number]
  return (
    <>
      <lineSegments geometry={line}>
        <lineBasicMaterial color={colour} transparent opacity={0.8} />
      </lineSegments>
      {label !== null && (
        <sprite position={at} scale={[0.6, 0.15, 1]} center={[0, 0.5]}>
          <spriteMaterial map={label} transparent depthWrite={false} />
        </sprite>
      )}
    </>
  )
}

/** A label drawn once onto a canvas, in the mono face and the axis's own colour. */
function labelTexture(text: string, colour: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')
  if (g === null) return null
  g.font = `500 30px ${cssToken('--font-mono') || 'monospace'}`
  g.fillStyle = colour
  g.textBaseline = 'middle'
  g.fillText(text, 6, 32)
  return new CanvasTexture(canvas)
}

/**
 * A player to scale, 1.8 blocks tall, two blocks in from where the axes meet and facing
 * the middle. Plain proportions in sixteenths of a block: legs 12, body 12, head 8.
 */
const PLAYER_PARTS = [
  [-2, 6, 4, 12, 4],
  [2, 6, 4, 12, 4],
  [0, 18, 8, 12, 4],
  [-6, 18, 4, 12, 4],
  [6, 18, 4, 12, 4],
  [0, 28, 8, 8, 8],
] as const

function Player({
  step,
  ground,
  colour,
}: {
  step: number
  ground: number
  colour: Color | undefined
}) {
  return (
    <group
      position={[-1 + 2 * step, -ground, -1 + 2 * step]}
      rotation={[0, Math.PI / 4, 0]}
      scale={(1.8 * step) / 32}
    >
      {PLAYER_PARTS.map(([x, y, w, h, d], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={colour} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
