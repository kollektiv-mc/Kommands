import { hasArgument, hasFlag } from '../../binding'
import type { PreviewModule } from '../../types'

/**
 * `worldedit/shape` — the first preview module.
 *
 * Previews `//generate` by evaluating its expression across the selection and drawing
 * the positions where it is true. The descriptor is all that is eager; everything that
 * imports Three.js sits behind `load`.
 */
export const shapePreview: PreviewModule = {
  id: 'worldedit/shape',

  // The dynamic import that keeps Three.js out of the entry chunk. A static import here
  // would put the whole renderer in front of someone who only ever opens /give.
  load: () => import('./ShapePreview'),

  // Types, not just names. `hasArgument` fails if `expression` is renamed, removed,
  // duplicated, or re-typed — the last of which is the one a name check cannot see and
  // the one that would render an empty canvas in production.
  accepts: (definition) =>
    definition.dialect === 'worldedit' &&
    hasArgument(definition, 'expression', 'we_expression') &&
    hasArgument(definition, 'pattern', 'we_pattern') &&
    hasFlag(definition, '-h'),
}
