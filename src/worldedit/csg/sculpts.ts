import { buildTree, type CsgTree } from './tree'

/**
 * Graphs that stand in for what someone actually builds.
 *
 * Shared by the bench and by the length ratchet in `compile.test.ts`, because both are
 * asking about the same thing from different sides: whether a graph of a realistic size
 * produces a command of a realistic length, and whether that command is cheap enough to
 * evaluate a quarter of a million times per edit.
 *
 * The twenty-operation sculpt is the important one. `docs/generate-editor.md` costs the
 * whole approach on it — "A twenty-operation sculpt is a long line, not an impossible
 * one" — against a command-block ceiling of about 32,500 characters, and until now
 * nothing in the repo checked that claim.
 */
export interface Sculpt {
  name: string
  tree: () => CsgTree
}

export const SCULPTS: readonly Sculpt[] = [
  {
    name: 'one primitive',
    tree: () => buildTree((add) => add({ kind: 'sphere', radius: 1 })),
  },
  {
    name: 'a shell, sharing one subexpression',
    tree: () =>
      buildTree((add) =>
        add({
          kind: 'subtract',
          base: add({ kind: 'sphere', radius: 1 }),
          tools: [add({ kind: 'sphere', radius: 0.7 })],
        }),
      ),
  },
  {
    name: 'four rotations, nested',
    tree: () =>
      buildTree((add) => {
        let id = add({ kind: 'box', half: [0.6, 0.3, 0.5] })
        for (const [axis, angle] of [
          ['z', 0.4],
          ['x', 0.3],
          ['y', 0.7],
          ['z', 0.2],
        ] as const) {
          id = add({ kind: 'rotate', axis, angle, child: id })
        }
        return id
      }),
  },
  {
    name: 'twenty operations',
    tree: () =>
      buildTree((add) => {
        // A plausible sculpt rather than a random one: a body, some limbs unioned on,
        // a couple of holes drilled through, and the whole thing tilted.
        const body = add({
          kind: 'scale',
          factor: [1, 0.6, 0.8],
          child: add({ kind: 'sphere', radius: 0.9 }),
        })
        const limb = add({ kind: 'cylinder', radius: 0.12, height: 1.4, axis: 'y' })
        const limbs = [0.35, -0.35].map((dx) =>
          add({ kind: 'translate', offset: [dx, -0.3, 0], child: limb }),
        )
        const ring = add({ kind: 'torus', major: 0.55, minor: 0.12, axis: 'y' })
        const hole = add({ kind: 'cylinder', radius: 0.2, height: 2, axis: 'z' })
        const holes = [0.3, -0.3].map((dy) =>
          add({ kind: 'translate', offset: [0, dy, 0], child: hole }),
        )
        const plate = add({ kind: 'plane', normal: [0, 1, 0], distance: 0.75 })

        const solid = add({
          kind: 'union',
          children: [body, ...limbs, add({ kind: 'translate', offset: [0, 0.5, 0], child: ring })],
        })
        const trimmed = add({ kind: 'intersect', children: [solid, plate] })
        const drilled = add({ kind: 'subtract', base: trimmed, tools: holes })
        return add({ kind: 'rotate', axis: 'z', angle: 0.25, child: drilled })
      }),
  },
]
