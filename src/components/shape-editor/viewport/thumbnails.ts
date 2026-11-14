import {
  AmbientLight,
  DirectionalLight,
  Euler,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three'
import type { TemplateSpec } from '../../../data/authored/generate'
import { shapeVoxels, type VoxelField } from '../../../previews/worldedit/shape/voxels'
import { readGenerate, stackCommand } from '../../../worldedit/stack/command'
import type { Layer } from '../../../worldedit/stack/layers'
import { templateLayers } from '../../../worldedit/stack/templates'
import { HOME, blockTexture, faceGeometry } from './blockMesh'
import { blockPalette, faceArrays } from './faces'
import type { VoxelReply, VoxelRequest } from './useVoxels'

/**
 * The templates' pictures: each template's blocks, from where the view's camera rests,
 * drawn once per session by a small offscreen renderer and kept as an image.
 *
 * Its own module behind a dynamic import, so Three.js stays out of the entry chunk and
 * the dialog opens before any picture is ready. Where there is no WebGL (jsdom), a
 * picture is the empty string and the card keeps its plain well.
 */

/** Samples per axis: enough to read the shape in a card, cheap enough to do eight. */
const SIZE = 40
const WIDTH = 320
const HEIGHT = 240
const DEG = Math.PI / 180

/** One set of blocks in a picture: the template's own, or one of its references. */
export interface PicturePart {
  source: string
  pattern: string
  hollow: boolean
  /** Where its parents put it, as the view places a Reference. */
  matrix: Matrix4
  opacity: number
}

/**
 * What a template's picture is made of. Its own blocks come first; each visible
 * Reference follows, placed through its groups' transforms and drawn a little
 * see-through, as the view draws it.
 */
export function pictureParts(template: TemplateSpec): PicturePart[] {
  const layers = templateLayers(template)
  const parts: PicturePart[] = []
  const own = stackCommand({ layers, pattern: template.pattern, hollow: false, round: false })
  if (own.expression !== '') {
    parts.push({
      source: own.expression,
      pattern: template.pattern,
      hollow: false,
      matrix: new Matrix4(),
      opacity: 1,
    })
  }
  const walk = (list: readonly Layer[], parent: Matrix4) => {
    for (const layer of list) {
      if (!layer.visible || layer.type === 'modifier' || layer.type === 'shape') continue
      const matrix = parent.clone().multiply(placement(layer))
      if (layer.type === 'group') walk(layer.children, matrix)
      else {
        const read = readGenerate(layer.command)
        if (!read.ok || read.expression === '') continue
        const { expression: source, pattern, hollow } = read
        parts.push({ source, pattern, hollow, matrix, opacity: 0.85 })
      }
    }
  }
  walk(layers, new Matrix4())
  return parts
}

function placement(layer: Layer): Matrix4 {
  const [rx, ry, rz] = layer.rot
  return new Matrix4().compose(
    new Vector3(...layer.pos),
    new Quaternion().setFromEuler(new Euler(rx * DEG, ry * DEG, rz * DEG)),
    new Vector3(...layer.scl),
  )
}

const pictures = new Map<string, Promise<string>>()

/** A template's picture as a data URL, or '' where it cannot be drawn. Kept by id. */
export function pictureOf(template: TemplateSpec): Promise<string> {
  const kept = pictures.get(template.id)
  if (kept !== undefined) return kept
  const made = draw(template)
  pictures.set(template.id, made)
  return made
}

/** Forgets every picture; for tests. */
export function forgetPictures() {
  pictures.clear()
}

async function draw(template: TemplateSpec): Promise<string> {
  const parts = pictureParts(template)
  if (parts.length === 0) return ''
  drawing++
  try {
    const fields = await Promise.all(parts.map((p) => evaluate(p.source, p.hollow)))
    return render(parts, fields)
  } catch {
    return ''
  } finally {
    if (--drawing === 0) release()
  }
}

/** Pictures asked for and not yet drawn; the renderer is let go when none are. */
let drawing = 0
let renderer: WebGLRenderer | null = null

function release() {
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
}

function render(parts: readonly PicturePart[], fields: readonly (VoxelField | null)[]): string {
  if (renderer === null) {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(WIDTH, HEIGHT, false)
  }
  const scene = new Scene()
  const key = new DirectionalLight(undefined, 1.6)
  key.position.set(4, 6, 3)
  const fill = new DirectionalLight(undefined, 0.4)
  fill.position.set(-4, -2, -3)
  scene.add(new AmbientLight(undefined, 1.1), key, fill)

  const texture = blockTexture()
  const made: Mesh<BufferGeometry, MeshLambertMaterial>[] = []
  parts.forEach((part, i) => {
    const field = fields[i]
    if (field === null || field === undefined) return
    const arrays = faceArrays(field.filled, field.size, blockPalette(part.pattern))
    if (arrays === null) return
    const material = new MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: part.opacity < 1,
      opacity: part.opacity,
      depthWrite: part.opacity === 1,
    })
    const mesh = new Mesh(faceGeometry(arrays), material)
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(part.matrix)
    scene.add(mesh)
    made.push(mesh)
  })

  const camera = new PerspectiveCamera(30, WIDTH / HEIGHT, 0.05, 50)
  camera.position.copy(HOME).multiplyScalar(0.92)
  camera.lookAt(0, -0.05, 0)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  for (const mesh of made) {
    mesh.geometry.dispose()
    mesh.material.dispose()
  }
  texture?.dispose()
  return url
}

let worker: Worker | null = null
let next = 0
const waiting = new Map<number, (field: VoxelField | null) => void>()

/**
 * A part's blocks, from a worker of the pictures' own that is let go once nothing is
 * waiting on it. Where there is no `Worker` (jsdom) it evaluates in place.
 */
function evaluate(source: string, hollow: boolean): Promise<VoxelField | null> {
  if (typeof Worker === 'undefined') {
    const result = shapeVoxels(source, SIZE, hollow)
    return Promise.resolve(result.ok ? result.field : null)
  }
  if (worker === null) {
    const w = new Worker(new URL('./voxels.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (event: MessageEvent<VoxelReply>) => {
      const reply = event.data
      const answer = waiting.get(reply.id)
      if (answer === undefined) return
      waiting.delete(reply.id)
      answer(reply.ok ? { size: reply.size, filled: reply.filled, count: reply.count } : null)
      if (waiting.size === 0) {
        w.terminate()
        if (worker === w) worker = null
      }
    }
    worker = w
  }
  const id = ++next
  const asked = worker
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    asked.postMessage({ id, source, size: SIZE, hollow } satisfies VoxelRequest)
  })
}
