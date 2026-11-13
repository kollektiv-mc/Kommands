import type { BinaryOperator, Expr } from '../expression/ast'

/**
 * Expression builders for the CSG compiler, folding identities and constants as they go.
 *
 * Every rewrite here is exact for finite doubles, which is what lets `compile.test.ts`
 * hold the compiler to `reference.ts` bit for bit: a fold produces the value the
 * unfolded expression would have evaluated to, never an approximation of it.
 */

// ── Expression builders, folding the identities as they go ──────────────────

export const num = (value: number): Expr => ({ kind: 'number', value })
export const name = (id: string): Expr => ({ kind: 'name', name: id, at: 0 })
export const numeric = (expr: Expr): number | undefined =>
  expr.kind === 'number' ? expr.value : undefined

/**
 * The built-ins this compiler emits, as the functions they are, for folding a call
 * whose arguments are all constants.
 *
 * That happens where a modifier pins a coordinate: a revolve evaluates its child at
 * z = 0, so a box under it would otherwise carry `abs(0)<1` into the command. These are
 * the same JavaScript functions the evaluator binds to the names (`functions.ts`), so a
 * folded call has exactly the value the unfolded one would have had in the preview.
 */
const FOLDABLE: Readonly<Record<string, (...args: number[]) => number>> = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  atan2: Math.atan2,
  round: Math.round,
  min: Math.min,
  max: Math.max,
}

export function call(fn: string, args: Expr[]): Expr {
  const values = args.map(numeric)
  const apply = FOLDABLE[fn]
  if (apply !== undefined && values.every((v) => v !== undefined)) {
    const folded = apply(...(values as number[]))
    if (Number.isFinite(folded)) return num(folded)
  }
  return { kind: 'call', name: fn, at: 0, args }
}

const COMPARE: Readonly<Partial<Record<BinaryOperator, (a: number, b: number) => boolean>>> = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

/** A comparison of two constants is a constant, 0 or 1, which absorption can then reach. */
export function binary(op: BinaryOperator, left: Expr, right: Expr): Expr {
  const [a, b] = [numeric(left), numeric(right)]
  const compare = COMPARE[op]
  if (compare !== undefined && a !== undefined && b !== undefined) return num(compare(a, b) ? 1 : 0)
  return { kind: 'binary', op, left, right }
}

export const negate = (expr: Expr): Expr => {
  const value = numeric(expr)
  return value !== undefined ? num(-value) : { kind: 'unary', op: '-', operand: expr }
}

/**
 * Arithmetic identities, folded while building.
 *
 * Not an optimisation pass — a rotation by zero would otherwise emit `x*1+y*0` and a
 * translation by zero `x-0`, on every axis of every transform, and the output is a line
 * someone reads. Each identity is exact for finite doubles; the only value they change
 * is the sign of a zero, which no comparison can see.
 */
export function add(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x + y)
  if (y === 0) return a
  if (x === 0) return b
  return binary('+', a, b)
}

export function sub(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x - y)
  if (y === 0) return a
  // Translating by a negative offset is as common as by a positive one, and `x- -0.4`
  // costs three characters over `x+0.4` — two for the negation and one for the space the
  // no-merge rule has to insert so it does not lex as a decrement.
  if (y !== undefined && y < 0) return binary('+', a, num(-y))
  return binary('-', a, b)
}

export function mul(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x * y)
  if (y === 1) return a
  if (x === 1) return b
  if (y === 0 || x === 0) return num(0)
  // A quarter turn's other coefficient: `-z` rather than `z*-1`, and the same value.
  if (y === -1) return negate(a)
  if (x === -1) return negate(b)
  return binary('*', a, b)
}

export function div(a: Expr, b: Expr): Expr {
  const [x, y] = [numeric(a), numeric(b)]
  if (x !== undefined && y !== undefined) return num(x / y)
  if (y === 1) return a
  return binary('/', a, b)
}

export const square = (expr: Expr): Expr => binary('^', expr, num(2))

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
export function constantSquare(value: number): Expr {
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
export const asPredicate = (expr: Expr): Expr =>
  isPredicate(expr) ? expr : binary('>', expr, num(0))

export function not(expr: Expr): Expr {
  const operand = asPredicate(expr)
  const value = numeric(operand)
  return value !== undefined ? num(value === 0 ? 1 : 0) : { kind: 'unary', op: '!', operand }
}

/**
 * `&&` and `||`, with a constant side folded away.
 *
 * Sound because both sides are 0/1 predicates by then: `1&&b` is `b`, `0&&b` is `0`,
 * and `||` the other way round. Over arbitrary numbers none of that would hold.
 */
export function logical(op: '&&' | '||', left: Expr, right: Expr): Expr {
  const [l, r] = [asPredicate(left), asPredicate(right)]
  const [a, b] = [numeric(l), numeric(r)]
  const absorbing = op === '&&' ? 0 : 1
  if (a === absorbing || b === absorbing) return num(absorbing)
  if (a !== undefined) return r
  if (b !== undefined) return l
  return { kind: 'logical', op, left: l, right: r }
}
