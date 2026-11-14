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
