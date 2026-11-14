/**
 * The //generate editor's document: a layer stack.
 *
 * `docs/generate-editor.md` § The layer stack is the design. Each list is read top to
 * bottom: a shape combines with everything above it (Add unions, Cut subtracts, Overlap
 * intersects), a modifier and a Half act on everything below them, and a group is one
 * layer to its parent, which is the only way the stack branches. So the document is a
 * tree, and `lower.ts` maps it onto `CsgTree`.
 *
 * Plain data, so it can be saved inside a command's value tree, sent to a worker and
 * compared by value for undo. Angles are in degrees and sizes in the editor's units,
 * which are the expression's: −1..1 across the selection.
 */

import type { Vec3 } from '../csg'

export type { Vec3 }
export type AxisName = 'x' | 'y' | 'z'
export type Op = 'add' | 'cut' | 'overlap'

/** What every layer has: a name, a visibility, and where it sits in its parent. */
interface Placed {
  id: string
  name: string
  visible: boolean
  pos: Vec3
  /** Degrees, applied as Three's XYZ Euler order: z first, then y, then x. */
  rot: Vec3
  scl: Vec3
}

export interface ShapeParams {
  sphere: { radius: number }
  box: { width: number; height: number; depth: number }
  cylinder: { radius: number; height: number }
  torus: { major: number; minor: number }
  triangle: { width: number; height: number; depth: number }
  cone: { radius: number; height: number }
  gyroid: { frequency: number; threshold: number }
  formula: { source: string }
  /** The half-space below the layer's own x–z plane. Acts on what is below it, like a modifier. */
  half: Record<string, never>
}
export type ShapeKind = keyof ShapeParams

export type ShapeLayer = {
  [K in ShapeKind]: Placed & { type: 'shape'; kind: K; op: Op; params: ShapeParams[K] }
}[ShapeKind]

export interface ModifierParams {
  mirror: { axis: AxisName; side: '+' | '-' }
  distort: {
    type: 'wave' | 'twist'
    amplitude: number
    frequency: number
    /** Wave: which coordinate is pushed. */
    axis: AxisName
    /** Wave: which coordinate the wave runs along. */
    along: AxisName
    /** Twist: degrees turned from the bottom of the selection to the top. */
    twist: number
  }
  array: { axis: AxisName; spacing: number; count: number }
  radial: { count: number }
  /** `angle` is degrees per unit of length along the guide. */
  bend: { axis: AxisName; toward: AxisName; side: 'both' | '+' | '-'; angle: number }
  taper: { amount: number }
  revolve: Record<string, never>
}
export type ModifierKind = keyof ModifierParams

/** A modifier moves and turns but never scales, so its `scl` stays at one. */
export type ModifierLayer = {
  [K in ModifierKind]: Placed & { type: 'modifier'; kind: K; params: ModifierParams[K] }
}[ModifierKind]

export interface GroupLayer extends Placed {
  type: 'group'
  op: Op
  /** Whether the list shows its children. Not part of the shape. */
  open: boolean
  children: readonly Layer[]
}

/** Another //generate command, drawn beside this one and never part of it. */
export interface ReferenceLayer extends Placed {
  type: 'reference'
  command: string
  /** The template it was picked from, if it was. */
  template?: string
}

export type Layer = ShapeLayer | ModifierLayer | GroupLayer | ReferenceLayer

/** The whole document. Versioned because it is saved inside a command. */
export interface ShapeDocument {
  version: 1
  layers: readonly Layer[]
}

export const EMPTY_DOCUMENT: ShapeDocument = { version: 1, layers: [] }

/** A modifier and a Half act on the layers below them rather than combining with those above. */
export const actsBelow = (layer: Layer): layer is ModifierLayer | ShapeLayer =>
  layer.type === 'modifier' || (layer.type === 'shape' && layer.kind === 'half')

export const SHAPE_KINDS: readonly ShapeKind[] = [
  'sphere',
  'box',
  'cylinder',
  'torus',
  'triangle',
  'cone',
  'gyroid',
  'formula',
]

export const MODIFIER_KINDS: readonly ModifierKind[] = [
  'mirror',
  'distort',
  'array',
  'radial',
  'bend',
  'taper',
  'revolve',
]

/** Each kind's starting size: what a click on the palette adds. */
export const SHAPE_DEFAULTS: { readonly [K in ShapeKind]: ShapeParams[K] } = {
  sphere: { radius: 0.5 },
  box: { width: 0.8, height: 0.8, depth: 0.8 },
  cylinder: { radius: 0.4, height: 1 },
  torus: { major: 0.5, minor: 0.15 },
  triangle: { width: 0.9, height: 0.8, depth: 0.5 },
  cone: { radius: 0.45, height: 1 },
  gyroid: { frequency: 6, threshold: 0.3 },
  formula: { source: 'y<sin(x*4)*0.25' },
  half: {},
}

export const MODIFIER_DEFAULTS: { readonly [K in ModifierKind]: ModifierParams[K] } = {
  mirror: { axis: 'x', side: '+' },
  distort: { type: 'wave', amplitude: 0.1, frequency: 6, axis: 'x', along: 'y', twist: 120 },
  array: { axis: 'x', spacing: 0.5, count: 3 },
  radial: { count: 6 },
  bend: { axis: 'y', toward: 'x', side: 'both', angle: 60 },
  taper: { amount: -0.5 },
  revolve: {},
}

/** The kind's own name, which a new layer is called until someone renames it. */
export const KIND_LABELS: Readonly<
  Record<ShapeKind | ModifierKind | 'group' | 'reference', string>
> = {
  sphere: 'Sphere',
  box: 'Box',
  cylinder: 'Cylinder',
  torus: 'Torus',
  triangle: 'Triangle',
  cone: 'Cone',
  gyroid: 'Gyroid',
  formula: 'Formula',
  half: 'Half',
  mirror: 'Mirror',
  distort: 'Distort',
  array: 'Array',
  radial: 'Radial',
  bend: 'Bend',
  taper: 'Taper',
  revolve: 'Revolve',
  group: 'Group',
  reference: 'Reference',
}
