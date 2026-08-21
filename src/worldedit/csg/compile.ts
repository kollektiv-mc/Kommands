import type { Diagnostic } from '../../schema/types'
import type { BinaryOperator, Expr, Program, Stmt } from '../expression/ast'
import { parse } from '../expression/parse'
import { printExpr, printProgram } from '../expression/print'
import {
  axisFrame,
  perpendicular,
  treeProblems,
  type CsgNode,
  type CsgTree,
  type NodeId,
} from './tree'

/**
 * The operation graph, compiled down to expression source.
 *
 * `docs/generate-editor.md` § The decision: the command is a projection of the graph.
 * This is that projection, and it is a pure function — no canvas, no browser, no
 * three.js. Two things in it are load-bearing and neither is obvious.
 *
 * ## Frames
 *
 * A primitive is never the literal string `x^2+y^2+z^2<1`. It is built against three
 * coordinate *expressions* — a frame — so a transform is a change of frame rather than a
 * rewrite of its subtree's text, and nothing here ever assigns to `x`, `y` or `z`.
 *
 * The alternative is to save and restore them: `sx=x; x=(x-0.3); …; x=sx`. They are
 * writable, so it would work, and it is worse in four ways. Every expression statement
 * writes the shared result slot, so a restore at the end of a subtree *becomes the
 * result* — "the program ends with the predicate" would stop being one rule and become a
 * fragile invariant at every level of nesting. The slot namespace is flat and shared
 * with whatever a user hand-writes into a raw node. A saved coordinate cannot be shared
 * between two consumers in different frames, so sharing degrades to none. And a
 * subtree's meaning would depend on where it sat in the statement sequence, which is the
 * opposite of what a graph compiler is for.
 *
 * A consequence worth naming because the alternative looks obvious: **rotation compiles
 * to a matrix, never to `rotate()`**. That built-in writes back through its first two
 * arguments and so requires bare variable names, which would force a hoist before every
 * rotation and make the node side-effecting. The angle is a parameter, so `cos θ` and
 * `sin θ` are constants and a rotation is two linear combinations of the frame.
 *
 * ## Predicates
 *
 * `&&` and `||` return an **operand**, not a boolean — `0 || 5` is `5`. Every primitive
 * emits a comparison and so is already 0/1, but a raw node emits whatever was typed, and
 * `-1 || 1` is `-1`, which is not greater than zero and so reads as *false* where
 * false ∪ true is true. So every node's value is normalised to a 0/1 predicate at the
 * boundary with its consumer. That is also what makes flattening and double-negation
 * sound in `simplify.ts`.
 */

// ── Expression builders, folding the identities as they go ──────────────────

const num = (value: number): Expr => ({ kind: 'number', value })
const name = (id: string): Expr => ({ kind: 'name', name: id, at: 0 })
const call = (fn: string, args: Expr[]): Expr => ({ kind: 'call', name: fn, at: 0, args })
const binary = (op: BinaryOperator, left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  op,
  left,
  right,
})

const numeric = (expr: Expr): number | undefined =>
  expr.kind === 'number' ? expr.value : undefined

/**
 * Arithmetic identities, folded while building.
 *
 * Not an optimisation pass — a rotation by zero would otherwise emit `x*1+y*0` and a
 * translation by zero `x-0`, on every axis of every transform, and the output is a line
 * someone reads. Each identity is exact for finite doubles; the only value they change
 * is the sign of a zero, which no comparison can see.
 */
function add(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x + y)
  if (y === 0) return a
  if (x === 0) return b
  return binary('+', a, b)
}

function sub(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x - y)
  if (y === 0) return a
  // Translating by a negative offset is as common as by a positive one, and `x- -0.4`
  // costs three characters over `x+0.4` — two for the negation and one for the space the
  // no-merge rule has to insert so it does not lex as a decrement.
  if (y !== undefined && y < 0) return binary('+', a, num(-y))
  return binary('-', a, b)
}

function mul(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x * y)
  if (y === 1) return a
  if (x === 1) return b
  if (y === 0 || x === 0) return num(0)
  return binary('*', a, b)
}

function div(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x / y)
  if (y === 1) return a
  return binary('/', a, b)
}

const square = (expr: Expr): Expr => binary('^', expr, num(2))

/**
 * A constant squared, spelled whichever way is shorter.
 *
 * `1^2` folds to `1`, which is what makes a unit sphere thirteen characters. `0.1^2`
 * does *not* fold, because `0.010000000000000002` is fifteen characters longer and
 * float noise in a command someone reads is worse than a visible `^2`. The rule is the
 * compiler's general one: never make the output longer.
 *
 * Either spelling evaluates identically — `^` compiles to `**` — so the reference
 * interpreter agrees bit for bit whichever is chosen.
 */
function constantSquare(value: number): Expr {
  const folded = value ** 2
  return String(folded).length <= String(value).length + 2 ? num(folded) : square(num(value))
}

const COMPARISONS: ReadonlySet<string> = new Set(['==', '!=', '~=', '<', '<=', '>', '>='])

/** Whether an expression is already 0 or 1, so `&&` over it means what it looks like. */
function isPredicate(expr: Expr): boolean {
  switch (expr.kind) {
    case 'binary':
      return COMPARISONS.has(expr.op)
    case 'unary':
      return expr.op === '!'
    case 'logical':
      return isPredicate(expr.left) && isPredicate(expr.right)
    case 'number':
      return expr.value === 0 || expr.value === 1
    default:
      return false
  }
}

/** `EditSession.makeShape` places a block where the expression is greater than zero. */
const asPredicate = (expr: Expr): Expr => (isPredicate(expr) ? expr : binary('>', expr, num(0)))

const not = (expr: Expr): Expr => ({ kind: 'unary', op: '!', operand: asPredicate(expr) })

const logical = (op: '&&' | '||', left: Expr, right: Expr): Expr => ({
  kind: 'logical',
  op,
  left: asPredicate(left),
  right: asPredicate(right),
})

// ── Frames ─────────────────────────────────────────────────────────────────

/** The three coordinate expressions a node is evaluated against. */
type Frame = readonly [Expr, Expr, Expr]

const ROOT_FRAME: Frame = [name('x'), name('y'), name('z')]

const frameKey = (frame: Frame): string => frame.map(printExpr).join('|')

/**
 * The frame a transform's child sees.
 *
 * Transforms map the *point*, not the shape: to ask whether p is inside a shape moved by
 * d, ask whether p − d is inside the shape that has not moved. So every entry here is
 * the inverse of what the node is named after.
 */
function childFrame(node: CsgNode, frame: Frame): Frame {
  switch (node.kind) {
    case 'translate':
      return [
        sub(frame[0], num(node.offset[0])),
        sub(frame[1], num(node.offset[1])),
        sub(frame[2], num(node.offset[2])),
      ]

    case 'scale':
      return [
        div(frame[0], num(node.factor[0])),
        div(frame[1], num(node.factor[1])),
        div(frame[2], num(node.factor[2])),
      ]

    case 'rotate': {
      // Two linear combinations with constant coefficients — never the `rotate()`
      // built-in, which writes back through its arguments and so demands bare variable
      // names. Turned by −angle, because the point moves opposite to the shape.
      const { u, v, w } = axisFrame(node.axis)
      const cos = num(Math.cos(node.angle))
      const sin = num(Math.sin(node.angle))
      const minusSin = num(-Math.sin(node.angle))
      const turned: [Expr, Expr, Expr] = [num(0), num(0), num(0)]
      turned[u] = add(mul(frame[u], cos), mul(frame[v], sin))
      turned[v] = add(mul(frame[u], minusSin), mul(frame[v], cos))
      turned[w] = frame[w]
      return turned
    }

    default:
      return frame
  }
}

// ── Raw expression nodes ───────────────────────────────────────────────────

/** Functions that write back through an argument, or carry state between voxels. */
const IMPURE_CALLS: ReadonlySet<string> = new Set([
  'rotate',
  'swap',
  'megabuf',
  'gmegabuf',
  'closest',
  'gclosest',
])

/** Functions whose value changes between two calls, so sharing one would change the shape. */
const RANDOM_CALLS: ReadonlySet<string> = new Set(['random', 'randint'])

function eachSubexpression(expr: Expr, visit: (e: Expr) => void): void {
  visit(expr)
  for (const child of childExpressions(expr)) eachSubexpression(child, visit)
}

function childExpressions(expr: Expr): Expr[] {
  switch (expr.kind) {
    case 'unary':
    case 'factorial':
      return [expr.operand]
    case 'binary':
    case 'logical':
      return [expr.left, expr.right]
    case 'conditional':
      return [expr.test, expr.then, expr.otherwise]
    case 'assign':
      return [expr.value]
    case 'call':
      return expr.args
    default:
      return []
  }
}

function withChildren(expr: Expr, children: Expr[]): Expr {
  switch (expr.kind) {
    case 'unary':
      return { ...expr, operand: children[0]! }
    case 'factorial':
      return { ...expr, operand: children[0]! }
    case 'binary':
    case 'logical':
      return { ...expr, left: children[0]!, right: children[1]! }
    case 'conditional':
      return { ...expr, test: children[0]!, then: children[1]!, otherwise: children[2]! }
    case 'assign':
      return { ...expr, value: children[0]! }
    case 'call':
      return { ...expr, args: children }
    default:
      return expr
  }
}

const mapExpr = (expr: Expr, f: (e: Expr) => Expr): Expr =>
  withChildren(
    expr,
    childExpressions(expr).map((child) => f(child)),
  )

/**
 * A raw node's body, checked and substituted into its frame.
 *
 * Three rules, and each closes a hole rather than expressing a preference. A body of
 * more than one statement would interleave with the compiler's hoists and, because every
 * expression statement writes the shared result slot, could silently become the result.
 * An assignment would collide with the flat, unscoped slot namespace this compiler and
 * the user both write into. And a function that writes back through its argument, or
 * carries state between voxels, is not a function of position at all — which is what a
 * frame substitution assumes it is.
 */
function rawBody(source: string, frame: Frame, report: (message: string) => void): Expr {
  const { program, errors } = parse(source)
  if (errors.length > 0) {
    report(`the expression "${source}" does not parse: ${errors[0]!.message}`)
    return num(0)
  }

  const [only, ...rest] = program.body
  if (only === undefined || rest.length > 0 || only.kind !== 'expr') {
    report(`the expression "${source}" must be a single expression, with no statements around it`)
    return num(0)
  }

  let bad: string | undefined
  eachSubexpression(only.expr, (e) => {
    if (e.kind === 'assign' || e.kind === 'crement') bad ??= 'assigns to a variable'
    if (e.kind === 'call' && IMPURE_CALLS.has(e.name)) bad ??= `calls ${e.name}`
  })
  if (bad !== undefined) {
    report(`the expression "${source}" ${bad}, so it is not a function of position alone`)
    return num(0)
  }

  const substitute = (e: Expr): Expr => {
    if (e.kind === 'name') {
      if (e.name === 'x') return frame[0]
      if (e.name === 'y') return frame[1]
      if (e.name === 'z') return frame[2]
      return e
    }
    return mapExpr(e, substitute)
  }
  return substitute(only.expr)
}

// ── Building the expression ────────────────────────────────────────────────

function nodeExpression(
  tree: CsgTree,
  id: NodeId,
  frame: Frame,
  memo: Map<string, Expr>,
  report: (message: string) => void,
): Expr {
  // Keyed on the frame as well as the node: a node reached through two different
  // transforms is genuinely two different expressions, and sharing them would be wrong
  // rather than merely large. This is a guard against re-walking a shared subgraph, not
  // the sharing mechanism — that is `share`, below, and it works on the emitted text.
  const key = `${id}@${frameKey(frame)}`
  const held = memo.get(key)
  if (held !== undefined) return held

  const built = build(tree, id, frame, memo, report)
  memo.set(key, built)
  return built
}

function build(
  tree: CsgTree,
  id: NodeId,
  frame: Frame,
  memo: Map<string, Expr>,
  report: (message: string) => void,
): Expr {
  const node = tree.nodes[id]
  if (!node) return num(0)
  const [fx, fy, fz] = frame
  const at = (child: NodeId, f: Frame): Expr => nodeExpression(tree, child, f, memo, report)

  switch (node.kind) {
    case 'empty':
      return num(0)
    case 'universe':
      return num(1)

    case 'sphere':
      return binary('<', add(add(square(fx), square(fy)), square(fz)), constantSquare(node.radius))

    case 'box':
      return logical(
        '&&',
        logical(
          '&&',
          binary('<', call('abs', [fx]), num(node.half[0])),
          binary('<', call('abs', [fy]), num(node.half[1])),
        ),
        binary('<', call('abs', [fz]), num(node.half[2])),
      )

    case 'torus': {
      const [u, v] = perpendicular(node.axis)
      const { w } = axisFrame(node.axis)
      const ring = sub(num(node.major), call('sqrt', [add(square(frame[u]), square(frame[v]))]))
      return binary('<', add(square(ring), square(frame[w])), constantSquare(node.minor))
    }

    case 'cylinder': {
      const [u, v] = perpendicular(node.axis)
      const { w } = axisFrame(node.axis)
      return logical(
        '&&',
        binary('<', add(square(frame[u]), square(frame[v])), constantSquare(node.radius)),
        binary('<', call('abs', [frame[w]]), num(node.height / 2)),
      )
    }

    case 'plane':
      return binary(
        '<',
        add(
          add(mul(num(node.normal[0]), fx), mul(num(node.normal[1]), fy)),
          mul(num(node.normal[2]), fz),
        ),
        num(node.distance),
      )

    case 'gyroid': {
      const f = num(node.frequency)
      const s = (e: Expr): Expr => call('sin', [mul(e, f)])
      const c = (e: Expr): Expr => call('cos', [mul(e, f)])
      return binary(
        '<',
        add(add(mul(s(fx), c(fy)), mul(s(fy), c(fz))), mul(s(fz), c(fx))),
        num(node.threshold),
      )
    }

    case 'expression':
      return asPredicate(rawBody(node.source, frame, report))

    case 'translate':
    case 'scale':
    case 'rotate':
      return at(node.child, childFrame(node, frame))

    case 'union':
      return node.children.length === 0
        ? num(0)
        : node.children
            .map((child) => at(child, frame))
            .reduce((left, right) => logical('||', left, right))

    case 'intersect':
      return node.children.length === 0
        ? num(1)
        : node.children
            .map((child) => at(child, frame))
            .reduce((left, right) => logical('&&', left, right))

    case 'subtract':
      // `a&&!b&&!c` rather than `a&&!(b||c)`: same meaning, one character shorter per
      // tool, and it reads the way the operation is named.
      return node.tools.reduce(
        (left, tool) => logical('&&', left, not(at(tool, frame))),
        asPredicate(at(node.base, frame)),
      )

    case 'invert':
      return not(at(node.child, frame))
  }
}

// ── Sharing ────────────────────────────────────────────────────────────────

/**
 * How long a name is worth, in characters.
 *
 * With `n` uses of an expression that prints to `L` characters and a variable name of
 * `v` characters, writing it out costs `n·L`, and hoisting costs `v+1+L+1` for the
 * assignment plus `n·v` for the references. So hoisting pays when `n·L > L + n·v + v + 2`.
 * At two uses and a two-character name that is `L ≥ 9`: `x^2+y^2+z^2` hoists, `x*2` does
 * not.
 */
const worthHoisting = (uses: number, length: number, nameLength: number): boolean =>
  uses * length > length + uses * nameLength + nameLength + 2

interface Candidate {
  text: string
  expr: Expr
  uses: number
}

/** Names a compiler may take without colliding with anything a user wrote. */
function freePrefix(tree: CsgTree, requested?: string): string {
  const taken = new Set<string>()
  for (const node of Object.values(tree.nodes)) {
    if (node.kind !== 'expression') continue
    const { program } = parse(node.source)
    for (const stmt of program.body) {
      if (stmt.kind !== 'expr') continue
      eachSubexpression(stmt.expr, (e) => {
        if (e.kind === 'name' || e.kind === 'assign' || e.kind === 'crement') taken.add(e.name)
      })
    }
  }
  // Identifiers are `[A-Za-z][0-9A-Za-z_]*`, so a leading underscore is not available.
  // Lengthening the prefix rather than bumping a counter keeps the common case — no raw
  // nodes at all — at two characters, which is what the cost model above assumes.
  let prefix = requested ?? 'k'
  while ([...taken].some((used) => new RegExp(`^${prefix}\\d+$`).test(used))) prefix += 'k'
  return prefix
}

/**
 * Replace every repeated subexpression with one assignment and a reference.
 *
 * Keyed on the **printed form**, not on the graph node, and that is the finding that
 * decides it. `docs/generate-editor.md` offers `r = x^2+y^2+z^2; (r<1) && !(r<0.7)` as
 * the example — and that is a sphere minus a *smaller* sphere, which is two different
 * nodes. Memoising per node produces nothing there. Interning the emitted text produces
 * exactly it, and declines to share across frames for free, because a frame is part of
 * the text.
 *
 * Every expression here is a pure function of position, so hoisting can never change a
 * value — only how many times it is computed. The one exception is `random`, whose
 * whole point is to differ between calls, so anything containing it is left alone.
 */
function share(
  root: Expr,
  prefix: string,
): { hoists: Array<{ name: string; expr: Expr }>; root: Expr } {
  const counts = new Map<string, Candidate>()
  eachSubexpression(root, (expr) => {
    if (expr.kind === 'number' || expr.kind === 'name') return
    const text = printExpr(expr)
    const held = counts.get(text)
    if (held) held.uses++
    else counts.set(text, { text, expr, uses: 1 })
  })

  const impure = (expr: Expr): boolean => {
    let found = false
    eachSubexpression(expr, (e) => {
      if (e.kind === 'call' && RANDOM_CALLS.has(e.name)) found = true
    })
    return found
  }

  const names = new Map<string, string>()
  const substitute = (expr: Expr, skip?: string): Expr => {
    const text = printExpr(expr)
    const bound = names.get(text)
    if (bound !== undefined && text !== skip) return name(bound)
    return mapExpr(expr, (child) => substitute(child))
  }

  // Shortest first, which does two things at once. A hoist's own definition can then
  // reference the hoists it contains, because a subexpression is always shorter than
  // anything containing it. And every inner decision is already made when an outer one
  // is weighed, so its length is measured *after* substitution rather than before —
  // without which `x^2+y^2+z^2<1` looks like fourteen characters worth saving when
  // hoisting the sum has already reduced it to `k1<1`, and the compiler makes its own
  // output longer.
  const ordered = [...counts.values()]
    .filter((c) => c.uses > 1 && !impure(c.expr))
    .sort((a, b) => a.text.length - b.text.length || (a.text < b.text ? -1 : 1))

  const hoists: Array<{ name: string; expr: Expr }> = []
  for (const candidate of ordered) {
    const expr = substitute(candidate.expr, candidate.text)
    const bound = `${prefix}${hoists.length + 1}`
    if (!worthHoisting(candidate.uses, printExpr(expr).length, bound.length)) continue
    names.set(candidate.text, bound)
    hoists.push({ name: bound, expr })
  }

  return { hoists, root: substitute(root) }
}

// ── The entry point ────────────────────────────────────────────────────────

export interface CsgCompileOptions {
  /** Off writes every repeated subexpression out in full. Only the tests want that. */
  share?: boolean
  /** For a test that needs to know the names. Defaults to the shortest free one. */
  namePrefix?: string
}

export interface CsgCompilation {
  /** The expression, ready to be the `//generate` argument. Empty if it cannot compile. */
  source: string
  /** The same thing unprinted, so a preview can compile it without parsing text back. */
  program: Program
  /** Warnings. Never blocks: a graph that half-compiles still produces a command. */
  diagnostics: Diagnostic[]
}

/**
 * A graph, as expression source.
 *
 * The program always **ends with the predicate**, and that is a rule rather than a
 * convention: every expression statement writes the shared result slot, so a trailing
 * assignment would become the result. Hoists therefore all come first, and nothing is
 * appended after the root.
 */
export function compileTree(tree: CsgTree, options: CsgCompileOptions = {}): CsgCompilation {
  const diagnostics: Diagnostic[] = []
  const report = (message: string): void => {
    if (!diagnostics.some((d) => d.message === message)) {
      diagnostics.push({ severity: 'warning', message })
    }
  }

  const structural = treeProblems(tree)
  if (structural.length > 0) {
    structural.forEach(report)
    return { source: '', program: { body: [] }, diagnostics }
  }

  const built = nodeExpression(tree, tree.root, ROOT_FRAME, new Map(), report)
  const predicate = asPredicate(built)

  const { hoists, root } =
    options.share === false
      ? { hoists: [], root: predicate }
      : share(predicate, freePrefix(tree, options.namePrefix))

  const body: Stmt[] = [
    ...hoists.map((hoist): Stmt => ({
      kind: 'expr',
      expr: { kind: 'assign', op: '=', name: hoist.name, at: 0, value: hoist.expr },
    })),
    { kind: 'expr', expr: root },
  ]

  const program: Program = { body }
  return { source: printProgram(program), program, diagnostics }
}
