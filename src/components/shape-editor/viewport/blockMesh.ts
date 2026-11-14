import { BufferAttribute, BufferGeometry, CanvasTexture, NearestFilter, Vector3 } from 'three'
import { faceOutlines, type FaceArrays } from './faces'

/**
 * The pieces every drawing of blocks shares: the view's, and the template pictures'.
 * Three.js only, so it travels in the same lazy chunk as whatever draws.
 */

/** Where the camera looks from at rest: above, in front and a little to the right. */
export const HOME = new Vector3(3.1, 2.3, 3.7)

/** A faint bevel and grain, multiplied by each block's colour, so blocks read as blocks. */
export function blockTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 16
  const g = canvas.getContext('2d')
  if (g === null) return null
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15
      const v = Math.round(255 * (edge ? 0.74 : 0.9 + random() * 0.1))
      g.fillStyle = `rgb(${v} ${v} ${v})`
      g.fillRect(x, y, 1, 1)
    }
  const t = new CanvasTexture(canvas)
  t.magFilter = NearestFilter
  t.minFilter = NearestFilter
  return t
}

/** The exposed faces as a mesh's geometry. */
export function faceGeometry(arrays: FaceArrays): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(arrays.position, 3))
  geometry.setAttribute('normal', new BufferAttribute(arrays.normal, 3))
  geometry.setAttribute('uv', new BufferAttribute(arrays.uv, 2))
  geometry.setAttribute('color', new BufferAttribute(arrays.color, 3))
  geometry.setIndex(new BufferAttribute(arrays.index, 1))
  geometry.computeBoundingSphere()
  return geometry
}

/** The exposed faces' outlines, as line segments. */
export function outlineGeometry(arrays: FaceArrays): BufferGeometry {
  const { position, color } = faceOutlines(arrays)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('color', new BufferAttribute(color, 3))
  geometry.computeBoundingSphere()
  return geometry
}
