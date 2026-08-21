import type { Expr, Program, Stmt } from './ast'

/**
 * The AST, back out as source.
 *
 * The inverse of `parse.ts`, and transcribed from it rather than written from
 * convention — the grammar is the specification, and this file is not free to be tidier
 * than it. Everything here is a consequence of the ladder in that file: nothing about
 * parenthesisation is a judgement call, and where it looks like one the answer came from
 * reading `power()` and `postfix()`, not from what the operators usually mean.
 *
 * It exists because the CSG compiler builds ASTs and has to hand a *command* to someone
 * who will read and hand-edit it. Two properties matter and both are testable without a
 * canvas: printing then parsing is the identity, which `print.test.ts` asserts over the
 * whole upstream corpus; and the output is canonical, so it doubles as the key a
 * compiler interns shared subexpressions by.
 *
 * No whitespace is emitted anywhere. A `//generate` command is a line someone pastes
 * into a chat box with a character limit, and `x^2+y^2+z^2<1` is thirteen characters
 * only if nothing pads it. The one exception is the no-merge rule below.
 */

/**
 * Precedence, loosest first, matching the call chain in `parse.ts`.
 *
 * A child is parenthesised iff its precedence is *below* the minimum its position
 * allows. Which minimum that is comes from the production: the left operand of a
 * left-associative operator may be the operator itself, so its minimum is its own
 * level; the right operand may not, so its minimum is one higher.
 */
const PREC = {
  assign: 1,
  conditional: 2,
  or: 3,
  and: 4,
  equality: 5,
  relational: 6,
  shift: 7,
  additive: 8,
  multiplicative: 9,
  /** `^`. Left-associative, and *looser* than every prefix operator. */
  power: 10,
  /** `-x`, `+x`, `!x`, `~x`, `++x`, `--x`. */
  prefix: 11,
  /** `x!` — factorial — and `x++`. */
  postfix: 12,
  primary: 13,
} as const

const BINARY_PREC: Readonly<Record<string, number>> = {
  '==': PREC.equality,
  '!=': PREC.equality,
  '~=': PREC.equality,
  '<': PREC.relational,
  '<=': PREC.relational,
  '>': PREC.relational,
  '>=': PREC.relational,
  '<<': PREC.shift,
  '>>': PREC.shift,
  '+': PREC.additive,
  '-': PREC.additive,
  '*': PREC.multiplicative,
  '/': PREC.multiplicative,
  '%': PREC.multiplicative,
  '^': PREC.power,
}

/**
 * Operator spellings two characters long, from `lex.ts`'s own table.
 *
 * The no-merge rule reads this rather than a list of known-awkward pairs, so a spelling
 * added to the lexer cannot quietly start merging here. `**` is included because the
 * lexer treats it as `^`; nothing prints it, and leaving it out would be a rule that
 * happens to be safe rather than one that is right.
 */
const TWO_CHARACTER_OPERATORS: ReadonlySet<string> = new Set([
  '**',
  '<<',
  '>>',
  '==',
  '!=',
  '~=',
  '<=',
  '>=',
  '&&',
  '||',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '^=',
])

/** `ID : [A-Za-z] [0-9A-Za-z_]*` — lex.ts:155. */
const isIdPart = (c: string): boolean => /[0-9A-Za-z_]/.test(c)

/**
 * Emits text, inserting a space only where leaving it out would change the tokens.
 *
 * Two characters merge when they would lex as one longer thing: `a` and `b` into one
 * name, or `-` and `-` into the decrement operator. So `a - -b` prints `a- -b` and never
 * `a--b`, and `a! == b` prints `a! ==b` and never `a!==b`, which the lexer's
 * longest-match rule would read as `a`, `!=`, `=`.
 *
 * A single guard driven off the lexer's own tables, rather than a special case per
 * awkward pair — the pairs are a consequence, and enumerating consequences is how one
 * gets missed.
 */
class Writer {
  private out = ''

  write(text: string): void {
    if (text === '') return
    const prev = this.out[this.out.length - 1]
    const next = text[0]
    if (prev !== undefined && next !== undefined && merges(prev, next)) this.out += ' '
    this.out += text
  }

  toString(): string {
    return this.out
  }
}

const merges = (prev: string, next: string): boolean =>
  (isIdPart(prev) && isIdPart(next)) || TWO_CHARACTER_OPERATORS.has(prev + next)

/**
 * A number, spelled so it lexes back to itself.
 *
 * `String` round-trips every finite double exactly, exponent forms included — `1e+21`
 * and `1e-7` both lex. The non-finite spellings exist for totality rather than for use:
 * nothing builds one, and `1e999` is chosen over any word because the lexer has no
 * `Infinity` token and would read one as a name.
 */
function printNumber(value: number): string {
  if (Number.isNaN(value)) return '0/0'
  if (value === Number.POSITIVE_INFINITY) return '1e999'
  if (value === Number.NEGATIVE_INFINITY) return '-1e999'
  return String(value)
}

/**
 * What a printed expression binds like, from the outside.
 *
 * A negative literal is a *prefix* expression, not a primary: `-2` is a unary minus
 * applied to `2`, and printing it inside a factorial without parentheses would give `-1!`
 * — which parses as `-(1!)`. `(-1)!` is upstream's own test case, so this is pinned.
 */
function precedenceOf(expr: Expr): number {
  switch (expr.kind) {
    case 'number':
      if (Number.isNaN(expr.value)) return PREC.multiplicative
      return expr.value < 0 ? PREC.prefix : PREC.primary
    case 'name':
    case 'call':
      return PREC.primary
    case 'unary':
      return PREC.prefix
    case 'crement':
      return expr.prefix ? PREC.prefix : PREC.postfix
    case 'factorial':
      return PREC.postfix
    case 'binary':
      return BINARY_PREC[expr.op] ?? PREC.primary
    case 'logical':
      return expr.op === '||' ? PREC.or : PREC.and
    case 'conditional':
      return PREC.conditional
    case 'assign':
      return PREC.assign
  }
}

function child(w: Writer, expr: Expr, min: number): void {
  if (precedenceOf(expr) < min) {
    w.write('(')
    expr_(w, expr)
    w.write(')')
    return
  }
  expr_(w, expr)
}

function expr_(w: Writer, expr: Expr): void {
  switch (expr.kind) {
    case 'number':
      w.write(printNumber(expr.value))
      return

    case 'name':
      w.write(expr.name)
      return

    case 'call':
      w.write(expr.name)
      w.write('(')
      expr.args.forEach((arg, i) => {
        if (i > 0) w.write(',')
        // A call argument is a whole `expression`, so nothing in it ever needs
        // parentheses — the commas and the closing bracket already bound it.
        child(w, arg, PREC.assign)
      })
      w.write(')')
      return

    case 'unary':
      w.write(expr.op)
      // `unary()` recurses into itself, so a prefix operator's operand may be another
      // prefix expression but nothing looser.
      child(w, expr.operand, PREC.prefix)
      return

    case 'crement':
      if (expr.prefix) {
        w.write(expr.op)
        w.write(expr.name)
      } else {
        w.write(expr.name)
        w.write(expr.op)
      }
      return

    case 'factorial':
      // `postfix()` applies `!` to a `primary()`, so anything looser must be bracketed.
      child(w, expr.operand, PREC.postfix)
      w.write('!')
      return

    case 'binary': {
      const level = BINARY_PREC[expr.op] ?? PREC.primary
      // Left-associative throughout, `^` included — `2^3^2` is `(2^3)^2`. So the left
      // may be the same operator and the right may not.
      child(w, expr.left, level)
      w.write(expr.op)
      // `^`'s right operand is typed `unaryExpression` in the grammar, not
      // `powerExpression`, which is a whole level rather than the usual one step.
      child(w, expr.right, expr.op === '^' ? PREC.prefix : level + 1)
      return
    }

    case 'logical': {
      const level = expr.op === '||' ? PREC.or : PREC.and
      child(w, expr.left, level)
      w.write(expr.op)
      child(w, expr.right, level + 1)
      return
    }

    case 'conditional':
      // The test is a `logicalOr`, so a conditional or an assignment there needs
      // brackets; the branches are full assignments and never do.
      child(w, expr.test, PREC.or)
      w.write('?')
      child(w, expr.then, PREC.assign)
      w.write(':')
      child(w, expr.otherwise, PREC.assign)
      return

    case 'assign':
      // Only a bare name may be assigned to — `parse.ts` looks two tokens ahead rather
      // than parsing a left-hand side — so there is nothing to bracket on the left.
      w.write(expr.name)
      w.write(expr.op)
      child(w, expr.value, PREC.assign)
      return
  }
}

/**
 * Whether an `if` would swallow a following `else`.
 *
 * `if (a) if (b) c=1; else d=2;` binds the `else` to the inner `if`, so an outer `if`
 * with an else branch has to brace a then-branch that ends in an unmatched `if`.
 */
function danglingIf(stmt: Stmt): boolean {
  switch (stmt.kind) {
    case 'if':
      return stmt.otherwise === undefined || danglingIf(stmt.otherwise)
    case 'while':
      return danglingIf(stmt.body)
    case 'for':
    case 'simpleFor':
      return danglingIf(stmt.body)
    default:
      return false
  }
}

/**
 * A statement.
 *
 * `last` drops the terminating semicolon on the final statement of a program, because
 * that statement carries the expression's value and is conventionally written bare —
 * and because thirteen characters of sphere does not have one to spare.
 */
function stmt_(w: Writer, stmt: Stmt, last = false): void {
  switch (stmt.kind) {
    case 'expr':
      child(w, stmt.expr, PREC.assign)
      if (!last) w.write(';')
      return

    case 'block':
      w.write('{')
      stmt.body.forEach((inner) => stmt_(w, inner))
      w.write('}')
      return

    case 'if':
      w.write('if')
      w.write('(')
      child(w, stmt.test, PREC.assign)
      w.write(')')
      if (stmt.otherwise !== undefined && danglingIf(stmt.then)) {
        stmt_(w, { kind: 'block', body: [stmt.then] })
      } else {
        stmt_(w, stmt.then)
      }
      if (stmt.otherwise !== undefined) {
        w.write('else')
        stmt_(w, stmt.otherwise)
      }
      return

    case 'while':
      w.write('while')
      w.write('(')
      child(w, stmt.test, PREC.assign)
      w.write(')')
      stmt_(w, stmt.body)
      return

    case 'do':
      w.write('do')
      stmt_(w, stmt.body)
      w.write('while')
      w.write('(')
      child(w, stmt.test, PREC.assign)
      w.write(')')
      w.write(';')
      return

    case 'for':
      w.write('for')
      w.write('(')
      child(w, stmt.init, PREC.assign)
      w.write(';')
      child(w, stmt.test, PREC.assign)
      w.write(';')
      child(w, stmt.update, PREC.assign)
      w.write(')')
      stmt_(w, stmt.body)
      return

    case 'simpleFor':
      w.write('for')
      w.write('(')
      w.write(stmt.counter)
      w.write('=')
      child(w, stmt.first, PREC.assign)
      w.write(',')
      child(w, stmt.last, PREC.assign)
      w.write(')')
      stmt_(w, stmt.body)
      return

    case 'switch': {
      w.write('switch')
      w.write('(')
      child(w, stmt.target, PREC.assign)
      w.write(')')
      w.write('{')
      // `default:` goes back where it was, not at the end: fallthrough is positional, so
      // `case 1: … default: … case 2: …` runs the default on its way from 1 to 2. Moving
      // it changes what the switch does while still parsing.
      stmt.cases.forEach((one, i) => {
        if (stmt.fallback !== undefined && i === stmt.fallbackAt) writeFallback(w, stmt.fallback)
        w.write('case')
        w.write(printNumber(one.value))
        w.write(':')
        one.body.forEach((inner) => stmt_(w, inner))
      })
      if (stmt.fallback !== undefined && stmt.fallbackAt >= stmt.cases.length) {
        writeFallback(w, stmt.fallback)
      }
      w.write('}')
      return
    }

    case 'break':
      w.write('break')
      w.write(';')
      return

    case 'continue':
      w.write('continue')
      w.write(';')
      return

    case 'return':
      w.write('return')
      child(w, stmt.value, PREC.assign)
      if (!last) w.write(';')
      return

    case 'empty':
      w.write(';')
      return
  }
}

function writeFallback(w: Writer, body: readonly Stmt[]): void {
  w.write('default')
  w.write(':')
  body.forEach((inner) => stmt_(w, inner))
}

/** One expression, with no statement around it. The compiler's interning key. */
export function printExpr(expr: Expr): string {
  const w = new Writer()
  child(w, expr, PREC.assign)
  return w.toString()
}

/** A whole program, semicolon-separated, with none trailing. */
export function printProgram(program: Program): string {
  const w = new Writer()
  program.body.forEach((stmt, i) => stmt_(w, stmt, i === program.body.length - 1))
  return w.toString()
}
