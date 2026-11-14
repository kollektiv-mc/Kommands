import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  WireframeGeometry,
  type BufferGeometry,
} from 'three'
import type { ShapeLayer } from '../../../worldedit/stack/layers'

/**
 * A shape's outline in the view: what it is before anything is cut from it or any
 * modifier bends it.
 *
 * Each matches what `lower.ts` compiles, at the layer's own origin: a cylinder and a
 * cone stand centred on y, a torus lies flat, a triangle is a prism pointing up y with
 * its depth along z. A gyroid and a formula fill the whole selection, so they are drawn
 * as its box. A Half is a plane, drawn only while editing.
 */
export interface Ghost {
  /** The see-through body, when the shape has one. */
  solid: BufferGeometry | null
  lines: BufferGeometry
  /** A shape that fills the selection rather than a body of its own. */
  field: boolean
}

export function ghostOf(layer: ShapeLayer): Ghost | null {
  switch (layer.kind) {
    case 'sphere': {
      const { radius } = layer.params
      return wire(new SphereGeometry(radius, 28, 18), new SphereGeometry(radius, 16, 10))
    }
    case 'box': {
      const { width, height, depth } = layer.params
      return edged(new BoxGeometry(width, height, depth))
    }
    case 'cylinder': {
      const { radius, height } = layer.params
      return wire(
        new CylinderGeometry(radius, radius, height, 32),
        new CylinderGeometry(radius, radius, height, 16, 1),
      )
    }
    case 'torus': {
      const { major, minor } = layer.params
      const solid = new TorusGeometry(major, minor, 14, 40).rotateX(Math.PI / 2)
      return wire(solid, new TorusGeometry(major, minor, 6, 24).rotateX(Math.PI / 2))
    }
    case 'cone': {
      const { radius, height } = layer.params
      return wire(new ConeGeometry(radius, height, 32), new ConeGeometry(radius, height, 16, 1))
    }
    case 'triangle': {
      const { width, height, depth } = layer.params
      const outline = new Shape([
        new Vector2(-width / 2, -height / 2),
        new Vector2(width / 2, -height / 2),
        new Vector2(0, height / 2),
      ])
      const prism = new ExtrudeGeometry(outline, { depth, bevelEnabled: false })
      return edged(prism.translate(0, 0, -depth / 2))
    }
    case 'gyroid':
    case 'formula': {
      const box = new BoxGeometry(2, 2, 2)
      const lines = new EdgesGeometry(box)
      box.dispose()
      return { solid: null, lines, field: true }
    }
    case 'half':
      return null
  }
}

function wire(solid: BufferGeometry, coarse: BufferGeometry): Ghost {
  const lines = new WireframeGeometry(coarse)
  coarse.dispose()
  return { solid, lines, field: false }
}

function edged(solid: BufferGeometry): Ghost {
  return { solid, lines: new EdgesGeometry(solid), field: false }
}

/**
 * How strongly a ghost is drawn. In Blocks the blocks speak for themselves: only the
 * selected shape and the ones that take away (Cut, Overlap) show, since those are the
 * ones the blocks cannot. In Shapes every shape shows, and the blocks do not.
 */
export function ghostOpacity(
  layer: ShapeLayer,
  ghost: Ghost,
  { selected, shapes }: { selected: boolean; shapes: boolean },
): { solid: number; lines: number } {
  const quiet = layer.op === 'add' && !shapes && !selected
  return {
    solid: selected ? 0.16 : shapes ? 0.1 : 0,
    lines: selected ? 0.75 : quiet ? 0 : shapes ? 0.32 : ghost.field ? 0.12 : 0.28,
  }
}
