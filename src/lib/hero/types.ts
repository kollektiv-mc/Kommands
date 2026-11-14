import type { Field, Vec3 } from './voxels'

/** The argument colours of docs/home-page.md: `--arg-1` to `--arg-4`. */
export type ArgColour = 1 | 2 | 3 | 4

/** A chip a tile grows: a component, a tag, a selector filter. */
export interface HeroChip {
  name: string
  value: string
  /** Drawn with a dropdown chevron. */
  dropdown?: boolean
}

/** The command's own word, typed and never a tile: `/give`, `/effect give`. */
export interface HeroLiteral {
  kind: 'literal'
  text: string
}

/** An argument: typed, coloured, then grown into the tile that edits it. */
export interface HeroArg {
  kind: 'arg'
  colour: ArgColour
  /** The tile's label. Absent on `/execute`, whose steps are the tiles. */
  label?: string
  /** What the control shows, and the head of what is typed. */
  value: string
  /** Typed after `value`, then folded away: the tile shows it as chips instead. */
  raw?: string
  /** The value the part ends on, when an `after` scene changes it. */
  end?: string
  dropdown?: boolean
  stepper?: boolean
  /** A colour swatch in the control: a fixed colour, or the shape's block colour. */
  swatch?: string | 'block'
  /** The control holds only `raw`, so the tile drops it once its chips arrive. */
  chipsOnly?: boolean
  chips?: readonly HeroChip[]
  /** A trailing add action under the chips, e.g. `+ Add component`. */
  add?: string
  /** `/execute`: the step's keyword and value on its tile. */
  step?: { keyword: string; value: string; run?: boolean }
  /** Not typed with the rest; the chain scene slots it in above `run`. */
  late?: boolean
  /** Typed onto the value afterwards, on its step and in the command together. */
  append?: string
}

export type HeroPart = HeroLiteral | HeroArg

/** A number a gizmo drag moves, or text that folds to an ellipsis. */
export type ExprPiece = string | { param: string } | { fold: string }

export type ShapeState = Record<string, number>

/** Which gizmo a drag holds: the vertical one (`top`) or the horizontal one (`side`). */
export type Handle = 'top' | 'side'

/** A `//generate` structure the hero builds and drags. */
export interface HeroShape {
  block: string
  /** The block's colour in the preview, `#rrggbb`. */
  colour: string
  /** Blocks along each axis of the selection. */
  n: number
  yaw: number
  init: ShapeState
  field: (s: ShapeState) => Field
  expr: (s: ShapeState) => readonly ExprPiece[]
  /** Where each gizmo sits, in selection space. */
  handles: Partial<Record<Handle, (s: ShapeState) => Vec3>>
  /** Each drag: the parameter, the value it ends on, and the gizmo that moves it. */
  drags: readonly (readonly [string, number, Handle])[]
  /** Draw a ring at the top gizmo's height, of radius `R`. */
  ring?: boolean
  /**
   * A second object, added and then switched to cut. `state.obj` is 0 before it is
   * added, 1 once added and 2 once cut.
   */
  object?: {
    name: 'Sphere' | 'Cylinder' | 'Box'
    base: (s: ShapeState) => Field
    field: (s: ShapeState) => Field
  }
}

/** One command of the hero's loop. */
export interface HeroCommand {
  /** Parts grow into tiles. False for `/execute`, whose steps are tiles beside it. */
  tiles: boolean
  /** What sits to the right of the command. */
  viz?: 'shape' | 'chain'
  parts: readonly HeroPart[]
}
