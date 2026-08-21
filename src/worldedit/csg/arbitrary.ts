import { buildTree, type CsgNode, type CsgTree, type NodeId } from './tree'

/**
 * Graphs and points to check a compiler against.
 *
 * Test support rather than product code, and kept out of `index.ts` for the same reason
 * `reference.ts` is: its only consumers are `compile.test.ts` and `simplify.test.ts`,
 * and both need the same corpus — one to check that compiling a graph preserves what it
 * means, the other that rewriting one does.
 *
 * Nothing here uses `Math.random`. A property test that cannot be run twice on the same
 * input is a property test whose failures cannot be looked at.
 */

/**
 * mulberry32. Five lines, no dependency, and the same sequence on every machine.
 *
 * A test that samples random points has to be reproducible or a failure cannot be
 * looked at twice, so `Math.random` is not available here even though this is the one
 * place it would be convenient.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const BASE_SEED = 20260821

/**
 * Where to look.
 *
 * The lattice matters more than the random points: parameters are round numbers, so
 * lattice points land exactly *on* boundaries, which is where a frame or a comparison
 * is wrong in a way that averages out anywhere else. The far points are there because a
 * mistaken transform can agree everywhere inside the unit cube and diverge outside it.
 */
export function samplePoints(random: () => number): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = []
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      for (let k = -2; k <= 2; k++) points.push([i / 2, j / 2, k / 2])
    }
  }
  for (let i = 0; i < 128; i++) {
    points.push([random() * 2 - 1, random() * 2 - 1, random() * 2 - 1])
  }
  for (const s of [-2, 2]) points.push([s, s, s], [s, 0, 0], [0, s, 0], [0, 0, s])
  return points
}

const AXES = ['x', 'y', 'z'] as const

export function randomTree(random: () => number, depth = 3): CsgTree {
  return buildTree((add) => grow(add, random, depth))
}

function grow(add: (node: CsgNode) => NodeId, random: () => number, depth: number): NodeId {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!
  const span = (): number => Math.round((random() * 1.6 - 0.8) * 10) / 10
  const size = (): number => Math.round((random() * 0.9 + 0.15) * 10) / 10

  if (depth <= 0 || random() < 0.35) {
    const kind = pick([
      'sphere',
      'box',
      'torus',
      'cylinder',
      'plane',
      'gyroid',
      'expression',
      'empty',
      'universe',
    ] as const)
    switch (kind) {
      case 'sphere':
        return add({ kind, radius: size() })
      case 'box':
        return add({ kind, half: [size(), size(), size()] })
      case 'torus':
        return add({ kind, major: size(), minor: size() / 2, axis: pick(AXES) })
      case 'cylinder':
        return add({ kind, radius: size(), height: size(), axis: pick(AXES) })
      case 'plane':
        return add({ kind, normal: [span(), span(), span()], distance: span() })
      case 'gyroid':
        return add({ kind, frequency: Math.round(random() * 8) + 1, threshold: span() })
      case 'expression':
        // Bodies that are deliberately *not* 0/1, which is the only thing that catches
        // a missing predicate normalisation: `-1 || 1` is `-1`, and reads as false.
        return add({ kind, source: pick(['x*2-1', 'y-z', 'x+y+z', 'sin(x*4)']) })
      default:
        return add({ kind })
    }
  }

  const kind = pick([
    'translate',
    'scale',
    'rotate',
    'union',
    'intersect',
    'subtract',
    'invert',
  ] as const)
  switch (kind) {
    case 'translate':
      return add({ kind, child: grow(add, random, depth - 1), offset: [span(), span(), span()] })
    case 'scale':
      return add({
        kind,
        child: grow(add, random, depth - 1),
        factor: [size() + 0.2, size() + 0.2, size() + 0.2],
      })
    case 'rotate':
      return add({
        kind,
        child: grow(add, random, depth - 1),
        axis: pick(AXES),
        angle: Math.round(random() * 12) / 2,
      })
    case 'invert':
      return add({ kind, child: grow(add, random, depth - 1) })
    case 'subtract':
      return add({
        kind,
        base: grow(add, random, depth - 1),
        tools: [grow(add, random, depth - 1)],
      })
    default: {
      const count = 2 + Math.floor(random() * 2)
      const children = Array.from({ length: count }, () => grow(add, random, depth - 1))
      return add({ kind, children })
    }
  }
}
