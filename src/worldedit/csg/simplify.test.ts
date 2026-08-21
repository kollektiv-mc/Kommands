import { describe, expect, test } from 'vitest'
import { BASE_SEED, randomTree, samplePoints, seeded } from './arbitrary'
import { compileTree } from './compile'
import { referenceFor } from './reference'
import { simplify } from './simplify'
import { buildTree, describeTree, type CsgTree } from './tree'

const shape = (build: Parameters<typeof buildTree>[0]): string =>
  describeTree(simplify(buildTree(build)))

describe('a transform that does nothing is removed', () => {
  test('a translation by zero', () => {
    expect(
      shape((add) =>
        add({ kind: 'translate', offset: [0, 0, 0], child: add({ kind: 'sphere', radius: 1 }) }),
      ),
    ).toBe('sphere(1)')
  })

  test('a scale by one, and a rotation by no angle', () => {
    expect(
      shape((add) =>
        add({ kind: 'scale', factor: [1, 1, 1], child: add({ kind: 'sphere', radius: 1 }) }),
      ),
    ).toBe('sphere(1)')
    expect(
      shape((add) =>
        add({ kind: 'rotate', axis: 'y', angle: 0, child: add({ kind: 'sphere', radius: 1 }) }),
      ),
    ).toBe('sphere(1)')
  })

  test('but a nearly-zero angle is left alone', () => {
    // An epsilon here would make the command differ from the graph someone is looking
    // at, which is worse than an operation that does almost nothing.
    expect(
      shape((add) =>
        add({ kind: 'rotate', axis: 'y', angle: 1e-9, child: add({ kind: 'sphere', radius: 1 }) }),
      ),
    ).toBe('rotate(y,1e-9,sphere(1))')
  })
})

describe('two transforms of a kind become one', () => {
  test('translations add', () => {
    expect(
      shape((add) =>
        add({
          kind: 'translate',
          offset: [0.1, 0, 0],
          child: add({
            kind: 'translate',
            offset: [0.2, 0.5, 0],
            child: add({ kind: 'sphere', radius: 1 }),
          }),
        }),
      ),
    ).toBe('translate([0.30000000000000004 0.5 0],sphere(1))')
  })

  test('scales multiply, and rotations about one axis add', () => {
    expect(
      shape((add) =>
        add({
          kind: 'scale',
          factor: [2, 2, 2],
          child: add({
            kind: 'scale',
            factor: [3, 1, 1],
            child: add({ kind: 'sphere', radius: 1 }),
          }),
        }),
      ),
    ).toBe('scale([6 2 2],sphere(1))')
    expect(
      shape((add) =>
        add({
          kind: 'rotate',
          axis: 'z',
          angle: 1,
          child: add({
            kind: 'rotate',
            axis: 'z',
            angle: 2,
            child: add({ kind: 'box', half: [1, 1, 1] }),
          }),
        }),
      ),
    ).toBe('rotate(z,3,box([1 1 1]))')
  })

  test('rotations about different axes do not, because that needs an affine node', () => {
    expect(
      shape((add) =>
        add({
          kind: 'rotate',
          axis: 'x',
          angle: 1,
          child: add({
            kind: 'rotate',
            axis: 'z',
            angle: 2,
            child: add({ kind: 'box', half: [1, 1, 1] }),
          }),
        }),
      ),
    ).toBe('rotate(x,1,rotate(z,2,box([1 1 1])))')
  })
})

describe('combinators flatten and absorb', () => {
  test('a union of unions is one union', () => {
    expect(
      shape((add) =>
        add({
          kind: 'union',
          children: [
            add({ kind: 'sphere', radius: 1 }),
            add({
              kind: 'union',
              children: [add({ kind: 'sphere', radius: 2 }), add({ kind: 'sphere', radius: 3 })],
            }),
          ],
        }),
      ),
    ).toBe('union(sphere(1),sphere(2),sphere(3))')
  })

  test('nothing is dropped from a union, and everything absorbs it', () => {
    expect(
      shape((add) =>
        add({
          kind: 'union',
          children: [add({ kind: 'sphere', radius: 1 }), add({ kind: 'empty' })],
        }),
      ),
    ).toBe('sphere(1)')
    expect(
      shape((add) =>
        add({
          kind: 'union',
          children: [add({ kind: 'sphere', radius: 1 }), add({ kind: 'universe' })],
        }),
      ),
    ).toBe('universe')
  })

  test('and an intersection is the mirror of that', () => {
    expect(
      shape((add) =>
        add({
          kind: 'intersect',
          children: [add({ kind: 'sphere', radius: 1 }), add({ kind: 'universe' })],
        }),
      ),
    ).toBe('sphere(1)')
    expect(
      shape((add) =>
        add({
          kind: 'intersect',
          children: [add({ kind: 'sphere', radius: 1 }), add({ kind: 'empty' })],
        }),
      ),
    ).toBe('empty')
  })

  test('an empty combinator is its own unit', () => {
    expect(shape((add) => add({ kind: 'union', children: [] }))).toBe('empty')
    expect(shape((add) => add({ kind: 'intersect', children: [] }))).toBe('universe')
  })

  test('subtracting nothing, and subtracting everything', () => {
    expect(
      shape((add) =>
        add({
          kind: 'subtract',
          base: add({ kind: 'sphere', radius: 1 }),
          tools: [add({ kind: 'empty' })],
        }),
      ),
    ).toBe('sphere(1)')
    expect(
      shape((add) =>
        add({
          kind: 'subtract',
          base: add({ kind: 'sphere', radius: 1 }),
          tools: [add({ kind: 'universe' })],
        }),
      ),
    ).toBe('empty')
  })

  test('inverting twice is inverting not at all', () => {
    expect(
      shape((add) =>
        add({
          kind: 'invert',
          child: add({ kind: 'invert', child: add({ kind: 'sphere', radius: 1 }) }),
        }),
      ),
    ).toBe('sphere(1)')
  })
})

describe('a primitive with no volume is nothing', () => {
  test('and so disappears from a union rather than sitting in the command', () => {
    expect(
      shape((add) =>
        add({
          kind: 'union',
          children: [add({ kind: 'sphere', radius: 0 }), add({ kind: 'box', half: [1, 1, 1] })],
        }),
      ),
    ).toBe('box([1 1 1])')
  })

  test('a cylinder with no height, and a torus with no thickness', () => {
    expect(shape((add) => add({ kind: 'cylinder', radius: 1, height: 0, axis: 'y' }))).toBe('empty')
    expect(shape((add) => add({ kind: 'torus', major: 1, minor: 0, axis: 'y' }))).toBe('empty')
  })
})

describe('sharing survives', () => {
  test('a node reached twice is rewritten once and stays one node', () => {
    const tree = simplify(
      buildTree((add) => {
        const sphere = add({ kind: 'sphere', radius: 1 })
        return add({ kind: 'union', children: [sphere, add({ kind: 'invert', child: sphere })] })
      }),
    )
    expect(describeTree(tree)).toBe('union(sphere(1),invert(&n1))')
    expect(Object.keys(tree.nodes)).toHaveLength(3)
  })

  test('and everything the rewriting orphaned is gone', () => {
    // The pre-flattening union, the transform that folded into its child. An orphan a
    // *user* left unwired is not removed — this is only the ones simplify created.
    const tree = simplify(
      buildTree((add) =>
        add({
          kind: 'translate',
          offset: [0, 0, 0],
          child: add({
            kind: 'translate',
            offset: [0, 0, 0],
            child: add({ kind: 'sphere', radius: 1 }),
          }),
        }),
      ),
    )
    expect(Object.keys(tree.nodes)).toEqual([tree.root])
  })
})

describe('simplifying is safe to do twice, and safe to do at all', () => {
  test('it is idempotent across the generated corpus', () => {
    for (let i = 0; i < 200; i++) {
      const once = simplify(randomTree(seeded(BASE_SEED + i)))
      expect(describeTree(simplify(once)), `seed ${BASE_SEED + i}`).toBe(describeTree(once))
    }
  })

  test('it never changes what the graph means', () => {
    // The assertion that matters. A simplify rule that is wrong looks fine in every
    // unit test above and produces a different shape — so it is checked the same way the
    // compiler is, against the reference interpreter at the same points.
    for (let i = 0; i < 200; i++) {
      const tree: CsgTree = randomTree(seeded(BASE_SEED + i))
      const before = referenceFor(tree)
      const after = referenceFor(simplify(tree))
      for (const [x, y, z] of samplePoints(seeded(BASE_SEED + i))) {
        expect(
          after(x, y, z),
          `seed ${BASE_SEED + i} at (${x}, ${y}, ${z})\n  before: ${describeTree(tree)}\n  after:  ${describeTree(simplify(tree))}`,
        ).toBe(before(x, y, z))
      }
    }
  })

  test('and never makes the command longer', () => {
    for (let i = 0; i < 200; i++) {
      const tree = randomTree(seeded(BASE_SEED + i))
      const plain = compileTree(tree).source
      const tidied = compileTree(simplify(tree)).source
      expect(tidied.length, `seed ${BASE_SEED + i}`).toBeLessThanOrEqual(plain.length)
    }
  })
})
