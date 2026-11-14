import { arch } from './arch'
import { colonnade } from './colonnade'
import { gyroid } from './gyroid'
import { planet } from './planet'
import { roots } from './roots'
import type { TemplateSpec } from './spec'
import { spire } from './spire'
import { tower } from './tower'
import { tree } from './tree'

export type { LayerSpec, TemplateSpec } from './spec'

/**
 * The block a new //generate document places, and the one its command names when the
 * Blocks field is left empty: a command needs a pattern to run at all.
 */
export const DEFAULT_PATTERN = 'stone'

/** The //generate editor's templates, in the order the dialog shows them. */
export const TEMPLATES: readonly TemplateSpec[] = [
  planet,
  arch,
  roots,
  colonnade,
  tree,
  tower,
  gyroid,
  spire,
]
