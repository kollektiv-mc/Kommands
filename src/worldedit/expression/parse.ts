import type { AssignOperator, BinaryOperator, Expr, Program, Stmt, SwitchCase } from './ast'
import { lex, type Token, type TokenKind } from './lex'

/**
 * Tokens to a syntax tree.
 *
 * Precedence climbing over the levels `Expression.g4` spells out as a rule each. The
 * grammar writes them as a chain of rules — `additiveExpression : multiplicativeExpression
 * (('+'|'-') multiplicativeExpression)*` and so on — which is the same thing as a table,
 * and a table is one place to check it against the source rather than twelve.
 *
 * Errors are collected and returned, never thrown: this feeds an argument-type validator,
 * and validation in this codebase warns without blocking.
 */

export interface ParseError {
  at: number
  message: string
}

/**
 * Binary precedence, loosest first. Taken rule-for-rule from the grammar.
 *
 * `^` is missing on purpose — both its operands are unary expressions rather than the
 * next level down, so it is handled in `power` rather than here.
 */
const BINARY_LEVELS: readonly (readonly BinaryOperator[])[] = [
  ['==', '!=', '~='],
  ['<', '<=', '>', '>='],
  ['<<', '>>'],
  ['+', '-'],
  ['*', '/', '%'],
]

const ASSIGN_OPS = new Set<TokenKind>(['=', '+=', '-=', '*=', '/=', '%=', '^='])

class Parser {
  private index = 0
  readonly errors: ParseError[] = []

  constructor(private readonly tokens: Token[]) {}

  private get current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!
  }

  private at(kind: TokenKind): boolean {
    return this.current.kind === kind
  }

  private eat(kind: TokenKind): boolean {
    if (!this.at(kind)) return false
    this.index++
    return true
  }

  private expect(kind: TokenKind): Token {
    const token = this.current
    if (token.kind !== kind) {
      this.fail(`Expected ${kind} here${token.kind === 'eof' ? ', but the expression ended' : ''}.`)
      // Do not consume: the caller's loop decides how to recover, and swallowing a token
      // the parser did not understand turns one error into a cascade of invented ones.
      return token
    }
    this.index++
    return token
  }

  private fail(message: string, at = this.current.at): void {
    // One error per position. A parser that has lost its place reports the same spot
    // repeatedly, and a field showing six warnings for one typo is worse than useless.
    if (this.errors.some((e) => e.at === at)) return
    this.errors.push({ at, message })
  }

  // ── Statements ────────────────────────────────────────────────────────────

  parseProgram(): Program {
    const body: Stmt[] = []
    while (!this.at('eof')) {
      const before = this.index
      body.push(this.statement())
      // Guarantee progress. Without this a statement that consumed nothing — because it
      // began with a token nothing accepts — spins forever.
      if (this.index === before) {
        this.fail(`${this.current.text || 'the end of the expression'} cannot start a statement.`)
        this.index++
      }
    }
    return { body }
  }

  private statement(): Stmt {
    if (this.eat(';')) return { kind: 'empty' }
    if (this.at('{')) return this.block()
    if (this.at('if')) return this.ifStatement()
    if (this.at('while')) return this.whileStatement()
    if (this.at('do')) return this.doStatement()
    if (this.at('for')) return this.forStatement()
    if (this.at('switch')) return this.switchStatement()
    if (this.eat('break')) return this.terminated({ kind: 'break' })
    if (this.eat('continue')) return this.terminated({ kind: 'continue' })
    if (this.eat('return')) {
      // `return` with nothing after it is `return 0` — the grammar allows the bare form.
      if (this.at(';') || this.at('eof') || this.at('}')) {
        return this.terminated({ kind: 'return', value: { kind: 'number', value: 0 } })
      }
      return this.terminated({ kind: 'return', value: this.expression() })
    }
    return this.terminated({ kind: 'expr', expr: this.expression() })
  }

  /**
   * A statement's optional trailing semicolon.
   *
   * Optional because the last statement carries the expression's value and is
   * conventionally written bare: `a=2; a^=3; a`. Requiring one would reject most real
   * expressions.
   */
  private terminated(statement: Stmt): Stmt {
    this.eat(';')
    return statement
  }

  private block(): Stmt {
    this.expect('{')
    const body: Stmt[] = []
    while (!this.at('}') && !this.at('eof')) {
      const before = this.index
      body.push(this.statement())
      if (this.index === before) {
        this.fail(`${this.current.text || 'the end of the expression'} cannot start a statement.`)
        this.index++
      }
    }
    this.expect('}')
    return { kind: 'block', body }
  }

  private ifStatement(): Stmt {
    this.expect('if')
    this.expect('(')
    const test = this.expression()
    this.expect(')')
    const then = this.statement()
    if (!this.eat('else')) return { kind: 'if', test, then }
    return { kind: 'if', test, then, otherwise: this.statement() }
  }

  private whileStatement(): Stmt {
    this.expect('while')
    this.expect('(')
    const test = this.expression()
    this.expect(')')
    return { kind: 'while', test, body: this.statement() }
  }

  private doStatement(): Stmt {
    this.expect('do')
    const body = this.statement()
    this.expect('while')
    this.expect('(')
    const test = this.expression()
    this.expect(')')
    this.eat(';')
    return { kind: 'do', body, test }
  }

  /**
   * Both `for` forms, told apart by what follows the first expression.
   *
   * `for (i = 0, 10) …` is WorldEdit's range loop and `for (i = 0; i < 10; ++i) …` is the
   * C one. They share a prefix, so the comma or semicolon decides.
   */
  private forStatement(): Stmt {
    this.expect('for')
    this.expect('(')
    const init = this.expression()
    if (this.eat(',')) {
      const last = this.expression()
      this.expect(')')
      const body = this.statement()
      if (init.kind !== 'assign' || init.op !== '=') {
        this.fail('A range for loop starts with a plain assignment, as in for (i = 0, 10).')
        return { kind: 'for', init, test: { kind: 'number', value: 0 }, update: init, body }
      }
      return { kind: 'simpleFor', counter: init.name, at: init.at, first: init.value, last, body }
    }
    this.expect(';')
    const test = this.expression()
    this.expect(';')
    const update = this.expression()
    this.expect(')')
    return { kind: 'for', init, test, update, body: this.statement() }
  }

  private switchStatement(): Stmt {
    this.expect('switch')
    this.expect('(')
    const target = this.expression()
    this.expect(')')
    this.expect('{')

    const cases: SwitchCase[] = []
    let fallback: Stmt[] | undefined
    let fallbackAt = 0

    while (!this.at('}') && !this.at('eof')) {
      const isDefault = this.at('default')
      let value = 0
      if (isDefault) {
        this.expect('default')
        if (fallback) this.fail('This switch already has a default.')
      } else {
        this.expect('case')
        value = this.constant()
      }
      this.expect(':')

      const body: Stmt[] = []
      while (!this.at('case') && !this.at('default') && !this.at('}') && !this.at('eof')) {
        const before = this.index
        body.push(this.statement())
        if (this.index === before) {
          this.fail(`${this.current.text || 'the end of the expression'} cannot start a statement.`)
          this.index++
        }
      }
      if (isDefault) {
        fallback = body
        fallbackAt = cases.length
      } else {
        cases.push({ value, body })
      }
    }
    this.expect('}')
    return fallback
      ? { kind: 'switch', target, cases, fallback, fallbackAt }
      : { kind: 'switch', target, cases, fallbackAt }
  }

  /** A case label. The grammar allows a signed number and nothing else. */
  private constant(): number {
    const negative = this.eat('-')
    if (!negative) this.eat('+')
    const token = this.expect('number')
    const value = Number(token.text)
    if (Number.isNaN(value)) {
      this.fail('A case label has to be a number.', token.at)
      return 0
    }
    return negative ? -value : value
  }

  // ── Expressions ───────────────────────────────────────────────────────────

  expression(): Expr {
    return this.assignment()
  }

  private assignment(): Expr {
    // An assignment is `ID op expression`, and nothing else may sit on the left. Looking
    // ahead two tokens is cheaper and clearer than parsing a conditional and then
    // discovering it should have been a target.
    const token = this.current
    const next = this.tokens[this.index + 1]
    if (token.kind === 'id' && next && ASSIGN_OPS.has(next.kind)) {
      this.index += 2
      return {
        kind: 'assign',
        op: next.kind as AssignOperator,
        name: token.text,
        at: token.at,
        value: this.assignment(),
      }
    }
    return this.conditional()
  }

  private conditional(): Expr {
    const test = this.logicalOr()
    if (!this.eat('?')) return test
    const then = this.assignment()
    this.expect(':')
    return { kind: 'conditional', test, then, otherwise: this.assignment() }
  }

  private logicalOr(): Expr {
    let left = this.logicalAnd()
    while (this.eat('||')) left = { kind: 'logical', op: '||', left, right: this.logicalAnd() }
    return left
  }

  private logicalAnd(): Expr {
    let left = this.binary(0)
    while (this.eat('&&')) left = { kind: 'logical', op: '&&', left, right: this.binary(0) }
    return left
  }

  private binary(level: number): Expr {
    const operators = BINARY_LEVELS[level]
    if (!operators) return this.power()

    let left = this.binary(level + 1)
    for (;;) {
      const op = operators.find((candidate) => this.at(candidate))
      if (!op) return left
      this.index++
      left = { kind: 'binary', op, left, right: this.binary(level + 1) }
    }
  }

  private unary(): Expr {
    if (this.at('++') || this.at('--')) {
      const op = this.current.kind as '++' | '--'
      this.index++
      const target = this.expect('id')
      return { kind: 'crement', op, name: target.text, at: target.at, prefix: true }
    }
    for (const op of ['-', '+', '!', '~'] as const) {
      if (this.eat(op)) return { kind: 'unary', op, operand: this.unary() }
    }
    return this.postfix()
  }

  /**
   * `^` / `**`, **left**-associative — `2^3^2` is `(2^3)^2 = 64`, not 512.
   *
   * That is the reverse of ordinary mathematical convention, and it is not ANTLR's
   * default associativity doing the work. The rule is
   * `powerExpression : unaryExpression | left=powerExpression POWER right=unaryExpression`,
   * with no `<assoc=right>` anywhere in the grammar — and because `right` is typed
   * *unaryExpression* rather than *powerExpression*, and nothing under `unaryExpression`
   * reaches back up except through `'(' expression ')'`, a right-nested tree is not
   * derivable at all. `2^(3^2)` needs the parentheses it is written with.
   *
   * The same typing puts every prefix operator BELOW `^`, which is the half that bites:
   * `-2^2` is `(-2)^2 = 4`, because `PlusMinusExpr`'s operand is also a unaryExpression
   * and so cannot contain the power. `2^-1` still parses, for exactly that reason.
   *
   * Upstream has no test pinning either — every `^` in `ExpressionTest`/`RealExpressionTest`
   * has an atomic or parenthesised base, and the one negative exponent is written `^(-2)`.
   * This was wrong here until the grammar was read rather than assumed.
   */
  private power(): Expr {
    let left = this.unary()
    while (this.eat('^')) left = { kind: 'binary', op: '^', left, right: this.unary() }
    return left
  }

  private postfix(): Expr {
    let operand = this.primary()
    for (;;) {
      if (this.eat('!')) {
        operand = { kind: 'factorial', operand }
        continue
      }
      if ((this.at('++') || this.at('--')) && operand.kind === 'name') {
        const op = this.current.kind as '++' | '--'
        this.index++
        operand = { kind: 'crement', op, name: operand.name, at: operand.at, prefix: false }
        continue
      }
      return operand
    }
  }

  private primary(): Expr {
    const token = this.current

    if (this.eat('(')) {
      const inner = this.expression()
      this.expect(')')
      return inner
    }

    if (token.kind === 'number') {
      this.index++
      const value = Number(token.text)
      if (Number.isNaN(value)) {
        this.fail(`${token.text} is not a number.`, token.at)
        return { kind: 'number', value: 0 }
      }
      return { kind: 'number', value }
    }

    if (token.kind === 'id') {
      this.index++
      if (!this.eat('(')) return { kind: 'name', name: token.text, at: token.at }
      const args: Expr[] = []
      if (!this.at(')')) {
        do {
          args.push(this.expression())
        } while (this.eat(','))
      }
      this.expect(')')
      return { kind: 'call', name: token.text, at: token.at, args }
    }

    this.fail(
      token.kind === 'eof'
        ? 'The expression ends before it says anything.'
        : `${token.text} cannot start a value.`,
    )
    return { kind: 'number', value: 0 }
  }
}

export function parse(source: string): { program: Program; errors: ParseError[] } {
  const lexed = lex(source)
  if ('failure' in lexed) {
    return { program: { body: [] }, errors: [lexed.failure] }
  }
  const parser = new Parser(lexed.tokens)
  const program = parser.parseProgram()
  return { program, errors: parser.errors }
}
