import type { LayerSpec, TemplateSpec } from '../../data/authored/generate'
import { compileTree, simplify } from '../csg'
import type { Layer } from './layers'
import { lowerLayers } from './lower'
import { group, modifier, reference, shape } from './make'

/**
 * A template as layers, with fresh ids each time it is used.
 *
 * It lands in one group named after the template, so it can be moved, hidden or deleted
 * as one thing. Each part in another block becomes a Reference holding its own
 * //generate command, compiled here from the stack the template gives for it.
 */
export function templateLayers(template: TemplateSpec): Layer[] {
  return [group(template.layers.map(fromSpec), { name: template.name })]
}

export function fromSpec(spec: LayerSpec): Layer {
  if ('shape' in spec) {
    const { shape: kind, ...options } = spec
    return shape(kind, options)
  }
  if ('modifier' in spec) {
    const { modifier: kind, ...options } = spec
    return modifier(kind, options)
  }
  if ('group' in spec) {
    const { group: children, ...options } = spec
    return group(children.map(fromSpec), options)
  }
  return reference({ name: spec.name, command: partCommand(spec.block, spec.part.map(fromSpec)) })
}

/** The //generate command a stack of layers writes, in one pattern. */
export function partCommand(pattern: string, layers: readonly Layer[]): string {
  return `//generate ${pattern} ${compileTree(simplify(lowerLayers(layers))).source}`
}
