import { describe, expect, test } from 'vitest'
import { compileProgram } from '../expression/compile'
import { compileExpression } from '../expression'
import { compileTree } from './compile'
import { referenceFor } from './reference'
import { SCULPTS } from './sculpts'
import { BASE_SEED, randomTree, samplePoints, seeded } from './arbitrary'
import { buildTree, describeTree, type CsgNode, type CsgTree } from './tree'

/**
 * The compiler, checked against an oracle rather than against expectations.
 *
 * `reference.ts` says what a graph means by walking it per point; `compile.ts` says the
 * same thing by building one expression with frames, sharing and printing. Neither
 * borrows anything from the other, so where they agree the machinery in the second is
 * doing no harm, and where they disagree exactly one of them is wrong about a shape.
 *
 * This is the layer that only became possible when the evaluator landed: without
 * something that runs the emitted text, a compiler can only be checked against strings
 * someone wrote down, which pins the output and not the meaning.
 */

/**
 * The graphs worth naming, rather than waiting for the generator to stumble on them.
 *
 * Each is a case where something in the compiler could be wrong in a way that ordinary
 * trees would not show.
 */
const NAMED_TREES: ReadonlyArray<{ name: string; tree: CsgTree }> = [
  {
    name: 'a diamond: one node, two consumers, one frame',
    tree: buildTree((add) => {
      const sphere = add({ kind: 'sphere', radius: 0.8 })
      const box = add({ kind: 'box', half: [0.5, 0.5, 0.5] })
      return add({
        kind: 'union',
        children: [add({ kind: 'intersect', children: [sphere, box] }), sphere],
      })
    }),
  },
  {
    name: 'one node under two different frames, which must not be shared',
    tree: buildTree((add) => {
      // The case that breaks a compiler memoising on node identity alone: the same
      // sphere, moved two different ways, is two different expressions. The offsets are
      // asymmetric so a wrongly-shared version is visibly the wrong shape rather than
      // accidentally the right one.
      //
      // Worth naming rather than trusting the generator to stumble on: dropping the
      // frame from the memo key was tried, and the two hundred generated graphs below
      // all still passed. Only this fixture and its golden caught it.
      const sphere = add({ kind: 'sphere', radius: 0.5 })
      return add({
        kind: 'union',
        children: [
          add({ kind: 'translate', child: sphere, offset: [0.4, 0, 0] }),
          add({ kind: 'translate', child: sphere, offset: [-0.7, 0.2, 0] }),
        ],
      })
    }),
  },
  {
    name: 'nested rotations about different axes',
    tree: buildTree((add) =>
      add({
        kind: 'rotate',
        axis: 'x',
        angle: 0.3,
        child: add({
          kind: 'rotate',
          axis: 'z',
          angle: 0.4,
          child: add({ kind: 'box', half: [0.6, 0.3, 0.5] }),
        }),
      }),
    ),
  },
  {
    name: 'a raw expression whose body is not a predicate',
    tree: buildTree((add) =>
      add({
        kind: 'union',
        children: [
          add({ kind: 'expression', source: 'x*2-1' }),
          add({ kind: 'sphere', radius: 0.3 }),
        ],
      }),
    ),
  },
  {
    name: 'a raw expression moved by a transform',
    tree: buildTree((add) =>
      add({
        kind: 'translate',
        offset: [0.25, -0.5, 0],
        child: add({ kind: 'expression', source: 'x*2-1' }),
      }),
    ),
  },
  {
    name: 'empty and universe in every combinator position',
    tree: buildTree((add) => {
      const nothing = add({ kind: 'empty' })
      const everything = add({ kind: 'universe' })
      const sphere = add({ kind: 'sphere', radius: 0.6 })
      return add({
        kind: 'subtract',
        base: add({ kind: 'union', children: [nothing, sphere] }),
        tools: [
          add({
            kind: 'intersect',
            children: [everything, add({ kind: 'invert', child: sphere })],
          }),
        ],
      })
    }),
  },
  {
    name: 'a shell: two different nodes sharing a subexpression',
    tree: buildTree((add) =>
      add({
        kind: 'subtract',
        base: add({ kind: 'sphere', radius: 1 }),
        tools: [add({ kind: 'sphere', radius: 0.7 })],
      }),
    ),
  },
]

// ── The differential test ──────────────────────────────────────────────────

function agree(tree: CsgTree, label: string, random: () => number): void {
  const compilation = compileTree(tree)
  const context = `${label}\n  graph: ${describeTree(tree)}\n  source: ${compilation.source}`

  expect(
    compilation.diagnostics.map((d) => d.message),
    context,
  ).toEqual([])

  const compiled = compileExpression(compilation.source)
  expect(compiled.ok, `${context}\n  did not parse back`).toBe(true)
  if (!compiled.ok) return

  // The preview will compile the program directly rather than re-parsing the text. If
  // those two ever disagreed, the canvas would draw something other than the command.
  const direct = compileProgram(compilation.program)
  const expected = referenceFor(tree)

  for (const [x, y, z] of samplePoints(random)) {
    const where = `${context}\n  at (${x}, ${y}, ${z})`
    const fromSource = compiled.expression.evaluate(x, y, z) > 0
    const fromProgram = direct.expression.evaluate(x, y, z) > 0
    expect(fromProgram, `${where}\n  program disagrees with its own source`).toBe(fromSource)
    expect(fromSource, where).toBe(expected(x, y, z))
  }
}

describe('the compiler and a direct interpretation agree', () => {
  for (const { name, tree } of NAMED_TREES) {
    test(name, () => agree(tree, name, seeded(BASE_SEED)))
  }

  test('and on two hundred generated graphs', () => {
    for (let i = 0; i < 200; i++) {
      const random = seeded(BASE_SEED + i)
      agree(randomTree(random), `generated graph, seed ${BASE_SEED + i}`, seeded(BASE_SEED + i))
    }
  })
})

// ── Shape of the output ────────────────────────────────────────────────────

describe('the emitted program', () => {
  const tree = buildTree((add) =>
    add({
      kind: 'subtract',
      base: add({ kind: 'sphere', radius: 1 }),
      tools: [add({ kind: 'sphere', radius: 0.7 })],
    }),
  )

  test('ends with the predicate, never with an assignment', () => {
    // Not a convention. Every expression statement writes the shared result slot, so a
    // trailing bookkeeping assignment would silently become the shape.
    const { program } = compileTree(tree)
    const last = program.body[program.body.length - 1]
    expect(last?.kind).toBe('expr')
    expect(last?.kind === 'expr' && last.expr.kind).not.toBe('assign')
  })

  test('puts every hoist before it', () => {
    const { program } = compileTree(tree)
    const kinds = program.body.map((s) => (s.kind === 'expr' ? s.expr.kind : s.kind))
    expect(kinds.slice(0, -1).every((k) => k === 'assign')).toBe(true)
  })

  test('is a long line for a twenty-operation sculpt, not an impossible one', () => {
    // The sentence docs/generate-editor.md costs the whole approach on, and nothing
    // checked it until now. The ceiling is a command block's ~32,500 characters; the
    // number here is loose enough to ignore a rounding change and tight enough that an
    // exponential blow-up in frames or sharing fails loudly.
    const sculpt = SCULPTS[SCULPTS.length - 1]!
    const shared = compileTree(sculpt.tree()).source
    const written = compileTree(sculpt.tree(), { share: false }).source

    expect(shared.length).toBeLessThan(1500)
    // And sharing is what buys that: written out in full it is more than twice as long.
    expect(written.length).toBeGreaterThan(shared.length * 2)
  })

  test('does not blow up exponentially under nested rotations', () => {
    // Each rotation builds both new coordinates out of both old ones, so substituting
    // naively doubles the text at every level. Hoisting cuts it at each level, by the
    // general rule rather than by a special case — which is the strongest argument for
    // that rule being the right shape.
    const nested = SCULPTS.find((s) => s.name === 'four rotations, nested')!
    const shared = compileTree(nested.tree()).source
    const written = compileTree(nested.tree(), { share: false }).source
    expect(shared.length).toBeLessThan(written.length * 0.7)
  })

  test('never gets longer for having shared something', () => {
    // The hoist rule is a size heuristic, and a heuristic that can lose is worth pinning:
    // deciding a nested hoist against its pre-substitution length does exactly that.
    for (let i = 0; i < 200; i++) {
      const tree_ = randomTree(seeded(BASE_SEED + i))
      const shared = compileTree(tree_).source
      const written = compileTree(tree_, { share: false }).source
      expect(shared.length, `seed ${BASE_SEED + i}: ${shared}`).toBeLessThanOrEqual(written.length)
    }
  })
})

// ── Golden output ──────────────────────────────────────────────────────────

/**
 * What the compiler actually emits, asserted exactly.
 *
 * The differential test says the output means the right thing; these say it is worth
 * reading. A simplification that made every command uglier would pass everything above
 * and fail here, which is where a reviewer should see it.
 *
 * Against `docs/generate-editor.md` § "primitives are short": sphere 13, box 34,
 * sphere − sphere 41 and gyroid 57 all match its counts exactly. The torus differs
 * because the doc writes its minor radius pre-squared, which no parameterisation of a
 * torus node can reproduce without asking a user for a squared length.
 */
describe('the shapes the design doc costs the whole approach on', () => {
  const golden = (name: string, node: CsgNode, expected: string) =>
    test(`${name} — ${expected.length} characters`, () => {
      expect(compileTree(buildTree((add) => add(node))).source).toBe(expected)
    })

  golden('sphere', { kind: 'sphere', radius: 1 }, 'x^2+y^2+z^2<1')
  golden('box', { kind: 'box', half: [0.8, 0.5, 0.8] }, 'abs(x)<0.8&&abs(y)<0.5&&abs(z)<0.8')
  golden(
    'torus',
    { kind: 'torus', major: 1, minor: 0.25, axis: 'y' },
    '(1-sqrt(x^2+z^2))^2+y^2<0.0625',
  )
  golden(
    'gyroid',
    { kind: 'gyroid', frequency: 6, threshold: 0.2 },
    'sin(x*6)*cos(y*6)+sin(y*6)*cos(z*6)+sin(z*6)*cos(x*6)<0.2',
  )
  golden(
    'cylinder',
    { kind: 'cylinder', radius: 0.5, height: 1, axis: 'y' },
    'x^2+z^2<0.25&&abs(y)<0.5',
  )
  golden('plane', { kind: 'plane', normal: [0, 1, 0], distance: 0.5 }, 'y<0.5')

  test('sphere minus a moved sphere', () => {
    const tree = buildTree((add) =>
      add({
        kind: 'subtract',
        base: add({ kind: 'sphere', radius: 1 }),
        tools: [
          add({
            kind: 'translate',
            offset: [0.3, 0, 0],
            child: add({ kind: 'sphere', radius: 0.7 }),
          }),
        ],
      }),
    )
    // 41 characters, which is what generate-editor.md's table says. Nothing is shared,
    // because the two spheres are in different frames.
    expect(compileTree(tree).source).toBe('x^2+y^2+z^2<1&&!((x-0.3)^2+y^2+z^2<0.7^2)')
  })
})

describe('sharing, shown against not sharing', () => {
  test('the doc’s own example is two different nodes, so only text-level sharing finds it', () => {
    // `r = x^2+y^2+z^2; (r<1) && !(r<0.7)` — a sphere minus a *smaller* sphere. There is
    // no node here that occurs twice, so a compiler memoising on node identity produces
    // nothing at all. Interning the emitted text produces exactly the doc's structure.
    const tree = buildTree((add) =>
      add({
        kind: 'subtract',
        base: add({ kind: 'sphere', radius: 1 }),
        tools: [add({ kind: 'sphere', radius: 0.7 })],
      }),
    )
    expect(compileTree(tree, { share: false }).source).toBe('x^2+y^2+z^2<1&&!(x^2+y^2+z^2<0.7^2)')
    expect(compileTree(tree).source).toBe('k1=x^2+y^2+z^2;k1<1&&!(k1<0.7^2)')
  })

  test('a node under two frames is left written out, because it is two expressions', () => {
    const tree = buildTree((add) => {
      const sphere = add({ kind: 'sphere', radius: 0.5 })
      return add({
        kind: 'union',
        children: [
          add({ kind: 'translate', child: sphere, offset: [0.4, 0, 0] }),
          add({ kind: 'translate', child: sphere, offset: [-0.4, 0, 0] }),
        ],
      })
    })
    expect(compileTree(tree).source).toBe('(x-0.4)^2+y^2+z^2<0.25||(x+0.4)^2+y^2+z^2<0.25')
  })

  test('a name that would collide with a raw node’s own gets a longer prefix', () => {
    const tree = buildTree((add) => {
      const raw = add({ kind: 'expression', source: 'k1+x' })
      const sphere = add({ kind: 'sphere', radius: 1 })
      return add({ kind: 'union', children: [raw, sphere, add({ kind: 'invert', child: sphere })] })
    })
    // There is no scoping — one flat slot namespace shared with whatever a user typed —
    // so taking `k1` here would silently read their variable instead of the hoist.
    const { program, source } = compileTree(tree)
    const hoisted = program.body
      .slice(0, -1)
      .map((s) => (s.kind === 'expr' && s.expr.kind === 'assign' ? s.expr.name : ''))

    expect(hoisted.length).toBeGreaterThan(0)
    expect(hoisted).not.toContain('k1')
    expect(hoisted.every((n) => n.startsWith('kk'))).toBe(true)
    // And the user's own `k1` is still theirs, still read.
    expect(source).toContain('k1+x')
  })
})

// ── Diagnostics ────────────────────────────────────────────────────────────

describe('a raw expression node has to be a function of position', () => {
  const compileRaw = (source: string) =>
    compileTree(buildTree((add) => add({ kind: 'expression', source }))).diagnostics.map(
      (d) => d.message,
    )

  test('an assignment is refused, because the slot namespace is shared', () => {
    expect(compileRaw('a=1; a')[0]).toContain('must be a single expression')
    expect(compileRaw('x<(a=1)')[0]).toContain('assigns to a variable')
  })

  test('a function that writes back through an argument is refused', () => {
    expect(compileRaw('rotate(x,y,1)')[0]).toContain('calls rotate')
    expect(compileRaw('megabuf(0,1)')[0]).toContain('calls megabuf')
  })

  test('something that does not parse says so, and produces no command', () => {
    const compilation = compileTree(
      buildTree((add) => add({ kind: 'expression', source: 'sin(x' })),
    )
    expect(compilation.diagnostics[0]?.message).toContain('does not parse')
  })

  test('a function this preview cannot draw is left to the evaluator to report', () => {
    // `perlin` makes a perfectly valid command; it is only the preview that cannot show
    // it. Reporting it here as well would be a second place to be wrong about it.
    expect(compileRaw('perlin(x,y,z,1,1,1)')).toEqual([])
  })
})

describe('a malformed graph produces no command rather than a wrong one', () => {
  test('a dangling child is reported', () => {
    const tree: CsgTree = {
      nodes: { n1: { kind: 'invert', child: 'gone' } },
      root: 'n1',
    }
    const compilation = compileTree(tree)
    expect(compilation.source).toBe('')
    expect(compilation.diagnostics[0]?.message).toContain('does not exist')
  })

  test('a cycle is reported rather than hanging', () => {
    const tree: CsgTree = {
      nodes: {
        n1: { kind: 'union', children: ['n2'] },
        n2: { kind: 'invert', child: 'n1' },
      },
      root: 'n1',
    }
    expect(compileTree(tree).diagnostics[0]?.message).toContain('reachable from itself')
  })

  test('a scale of zero is reported, because a frame divides by it', () => {
    const tree = buildTree((add) =>
      add({ kind: 'scale', factor: [1, 0, 1], child: add({ kind: 'sphere', radius: 1 }) }),
    )
    expect(compileTree(tree).diagnostics[0]?.message).toContain('factor of zero')
  })
})
