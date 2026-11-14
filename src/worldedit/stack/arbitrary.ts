import {
  MODIFIER_KINDS,
  SHAPE_KINDS,
  type AxisName,
  type Layer,
  type ModifierKind,
  type ModifierLayer,
  type Op,
  type ShapeKind,
  type Vec3,
} from './layers'
import { group, modifier, reference, shape } from './make'

/**
 * Random layer stacks, for the tests that compare the lowering with the oracle.
 *
 * The values are chosen to land in the awkward places: quarter steps that put faces on
 * the sample lattice, turns that are and are not quarter turns, scales that fold into a
 * primitive and ones that do not, modifiers that do nothing, and hidden layers, Halves
 * and references, which the command must skip or treat specially.
 */

type Random = () => number

const pickOf = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!

const AXES: readonly AxisName[] = ['x', 'y', 'z']
const OPS: readonly Op[] = ['add', 'add', 'cut', 'overlap']

const quarter = (random: Random, span: number): number =>
  Math.round((random() * 2 - 1) * span * 4) / 4

const vec = (f: () => number): Vec3 => [f(), f(), f()]

function turn(random: Random): Vec3 {
  const angle = (): number => pickOf(random, [0, 0, 30, 45, 90, -90, 180, 17.5])
  return random() < 0.4 ? [0, 0, 0] : vec(angle)
}

function scale(random: Random): Vec3 {
  const roll = random()
  if (roll < 0.5) return [1, 1, 1]
  if (roll < 0.75) {
    const s = pickOf(random, [0.5, 1.5, 2])
    return [s, s, s]
  }
  return vec(() => pickOf(random, [0.5, 1, 1.5]))
}

function randomShape(random: Random): Layer {
  const kind: ShapeKind = pickOf(random, SHAPE_KINDS)
  return shape(kind, {
    op: pickOf(random, OPS),
    pos: vec(() => quarter(random, 0.5)),
    rot: turn(random),
    scl: scale(random),
    ...(kind === 'formula' ? { params: { source: 'y<sin(x*4)*0.25&&x^2+z^2<0.5' } } : {}),
  })
}

function randomModifier(random: Random): Layer {
  const kind: ModifierKind = pickOf(random, MODIFIER_KINDS)
  const pos = vec(() => quarter(random, 0.25))
  const rot = random() < 0.6 ? ([0, 0, 0] as const) : turn(random)
  return modifier(kind, { pos, rot, params: modifierParams(kind, random) })
}

function modifierParams(kind: ModifierKind, random: Random): Partial<ModifierLayer['params']> {
  const axis = pickOf(random, AXES)
  switch (kind) {
    case 'mirror':
      return { axis, side: pickOf(random, ['+', '-'] as const) }
    case 'distort':
      return {
        type: pickOf(random, ['wave', 'twist'] as const),
        axis,
        along: pickOf(random, AXES),
        amplitude: pickOf(random, [0, 0.1, 0.25]),
        frequency: pickOf(random, [3, 6]),
        twist: pickOf(random, [0, 90, 120]),
      }
    case 'array':
      return { axis, spacing: pickOf(random, [0.25, 0.5]), count: pickOf(random, [1, 2, 3]) }
    case 'radial':
      return { count: pickOf(random, [1, 4, 6]) }
    case 'bend':
      return {
        axis,
        toward: pickOf(random, AXES),
        side: pickOf(random, ['both', '+', '-'] as const),
        angle: pickOf(random, [0, 60, -45, 900]),
      }
    case 'taper':
      return { amount: pickOf(random, [0, -0.5, 0.3]) }
    case 'revolve':
      return {}
  }
}

export function randomStack(random: Random, depth = 2): Layer[] {
  const length = 1 + Math.floor(random() * 5)
  const layers: Layer[] = []
  for (let i = 0; i < length; i++) {
    const roll = random()
    let layer: Layer
    if (roll < 0.15) layer = randomModifier(random)
    else if (roll < 0.22)
      layer = shape('half', {
        op: pickOf(random, OPS),
        pos: [0, quarter(random, 0.5), 0],
        rot: turn(random),
      })
    else if (roll < 0.35 && depth > 0) {
      layer = group(randomStack(random, depth - 1), {
        op: pickOf(random, OPS),
        ...(random() < 0.5
          ? {}
          : {
              pos: vec(() => quarter(random, 0.25)),
              rot: turn(random),
              scl: scale(random),
            }),
      })
    } else if (roll < 0.38) layer = reference({ command: '//generate stone x<0' })
    else layer = randomShape(random)
    layers.push(random() < 0.08 ? { ...layer, visible: false } : layer)
  }
  return layers
}
