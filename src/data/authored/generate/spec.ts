import type {
  ModifierKind,
  ModifierParams,
  Op,
  ShapeKind,
  ShapeParams,
  Vec3,
} from '../../../worldedit/stack/layers'

/**
 * The //generate editor's templates, written the short way.
 *
 * A template is a layer stack someone could have built in the editor, so the list shows
 * how the result is made. Anything left out takes the editor's default: no move, no
 * turn, a scale of one, the kind's own op and size. `part` is a stack of its own, in its
 * own block, compiled into a Reference beside the template's command: //generate takes
 * one pattern per command, so a second material is a second command.
 *
 * Every template stands on the floor of the selection: its lowest blocks land in the
 * bottom layer at 32³, 64³ and 128³. WorldEdit maps the selection's outer block centres
 * to exactly −1 and 1, and the primitives compare strictly, so a face resting on y = −1
 * leaves that layer empty. Each template's lowest parts therefore reach a little below
 * −1, and `templates.test.ts` holds them to it.
 */

interface Placed {
  name: string
  pos?: Vec3
  rot?: Vec3
}

export type ShapeSpec = {
  [K in ShapeKind]: Placed & { shape: K; op?: Op; scl?: Vec3; params?: Partial<ShapeParams[K]> }
}[ShapeKind]

export type ModifierSpec = {
  [K in ModifierKind]: Placed & { modifier: K; params?: Partial<ModifierParams[K]> }
}[ModifierKind]

export interface GroupSpec extends Placed {
  group: readonly LayerSpec[]
  op?: Op
  scl?: Vec3
}

export interface PartSpec {
  part: readonly LayerSpec[]
  name: string
  block: string
}

export type LayerSpec = ShapeSpec | ModifierSpec | GroupSpec | PartSpec

export interface TemplateSpec {
  id: string
  name: string
  /** The command's own pattern, which the template sets when it is used. */
  pattern: string
  layers: readonly LayerSpec[]
}
