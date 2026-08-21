import { describe, expect, test } from 'vitest'
import type { Expr, Stmt } from './ast'
import { SHAPE_CASES, SPEC_CASES } from './corpus'
import { compileExpression } from './index'
import { parse } from './parse'
import { printExpr, printProgram } from './print'

/**
 * Printing and parsing are inverses.
 *
 * The evidence is mostly free: `corpus.ts` already holds 89 cases and 7 shapes
 * transcribed from WorldEdit's own suite, and every one of them exercises the
 * precedence table this printer had to transcribe from `parse.ts`. Reprinting each and
 * evaluating it again turns a corpus written to specify the *language* into a corpus
 * that also specifies the *printer* — including the traps, which is exactly where a
 * printer written from ordinary convention goes wrong.
 *
 * Values are compared rather than source text, because `**` normalises to `^` in the
 * lexer and spelling deliberately does not survive. What must survive is meaning.
 */

const reprint = (source: string): string => printProgram(parse(source).program)

const evaluate = (source: string, x = 0, y = 0, z = 0): number => {
  const result = compileExpression(source)
  if (!result.ok) {
    throw new Error(`${source} — ${result.diagnostics.map((d) => d.message).join(' ')}`)
  }
  return result.expression.evaluate(x, y, z)
}

describe('every case in the upstream corpus survives a round trip', () => {
  for (const [group, cases] of Object.entries(SPEC_CASES)) {
    for (const [source, expected] of Object.entries(cases)) {
      test(`${group}: ${source}`, () => {
        expect(evaluate(reprint(source))).toBe(expected)
      })
    }
  }
})

describe('and so does every real shape, per point', () => {
  // The deepest expressions in the corpus, and so the best precedence coverage in it: a
  // misplaced bracket in a torus is a torus that is subtly the wrong shape, which is the
  // failure this whole product exists to avoid.
  for (const fixture of SHAPE_CASES) {
    test(fixture.name, () => {
      const printed = reprint(fixture.source)
      for (const [x, y, z, expected] of fixture.points) {
        expect(evaluate(printed, x, y, z) > 0 ? 1 : 0, `${printed} at (${x}, ${y}, ${z})`).toBe(
          expected,
        )
      }
    })
  }
})

describe('the output is canonical, not merely correct', () => {
  // Printing a reprint changes nothing. Cheap, and it catches a bracket that is wrong
  // but happens to evaluate the same at the sampled points.
  const sources = [
    ...Object.values(SPEC_CASES).flatMap((cases) => Object.keys(cases)),
    ...SHAPE_CASES.map((fixture) => fixture.source),
  ]

  test('reprinting is idempotent across the whole corpus', () => {
    for (const source of sources) {
      const once = reprint(source)
      expect(reprint(once), source).toBe(once)
    }
  })

  test('and emits no whitespace it does not need', () => {
    // Thirteen characters, which is the number docs/generate-editor.md argues the whole
    // approach on. A printer that padded operators would cost 12 more.
    expect(reprint('x^2 + y^2 + z^2 < 1')).toBe('x^2+y^2+z^2<1')
  })
})

/**
 * The cases the corpus has no *source* for.
 *
 * A source can only pin the printer where someone happened to write that source. These
 * are built as ASTs, which is how the CSG compiler will build them, and each one is a
 * tree whose natural spelling is wrong under this grammar.
 */
describe('the traps, built as trees rather than parsed from text', () => {
  const n = (value: number): Expr => ({ kind: 'number', value })
  const name = (id: string): Expr => ({ kind: 'name', name: id, at: 0 })
  const pow = (left: Expr, right: Expr): Expr => ({ kind: 'binary', op: '^', left, right })
  const neg = (operand: Expr): Expr => ({ kind: 'unary', op: '-', operand })
  const and = (left: Expr, right: Expr): Expr => ({ kind: 'logical', op: '&&', left, right })
  const or = (left: Expr, right: Expr): Expr => ({ kind: 'logical', op: '||', left, right })

  test('a negated power needs its brackets, and a power of a negative does not', () => {
    // The pair a printer written from mathematical habit gets exactly backwards.
    expect(printExpr(neg(pow(n(2), n(2))))).toBe('-(2^2)')
    expect(printExpr(pow(neg(n(2)), n(2)))).toBe('-2^2')
    expect(evaluate(printExpr(neg(pow(n(2), n(2)))))).toBe(-4)
    expect(evaluate(printExpr(pow(neg(n(2)), n(2))))).toBe(4)
  })

  test('a right-nested power needs its brackets, and a left-nested one does not', () => {
    expect(printExpr(pow(pow(n(2), n(3)), n(2)))).toBe('2^3^2')
    expect(printExpr(pow(n(2), pow(n(3), n(2))))).toBe('2^(3^2)')
    expect(evaluate(printExpr(pow(pow(n(2), n(3)), n(2))))).toBe(64)
    expect(evaluate(printExpr(pow(n(2), pow(n(3), n(2)))))).toBe(512)
  })

  test('an or inside an and needs brackets; an and inside an or does not', () => {
    // Which is the reverse of the instinct to bracket the first and leave the second.
    expect(printExpr(and(name('a'), or(name('b'), name('c'))))).toBe('a&&(b||c)')
    expect(printExpr(or(and(name('a'), name('b')), name('c')))).toBe('a&&b||c')
  })

  test('a negative literal beside a minus does not become a decrement', () => {
    expect(printExpr({ kind: 'binary', op: '-', left: name('a'), right: n(-1) })).toBe('a- -1')
    expect(printExpr({ kind: 'unary', op: '+', operand: n(1) })).toBe('+1')
    expect(evaluate(printExpr({ kind: 'binary', op: '-', left: n(3), right: n(-1) }))).toBe(4)
  })

  test('a factorial beside an equality does not become a not-equals', () => {
    const factorial: Expr = { kind: 'factorial', operand: name('a') }
    const compare: Expr = { kind: 'binary', op: '==', left: factorial, right: n(1) }
    // `a!==1` would lex longest-match as `a`, `!=`, `=` and fail to parse at all.
    expect(printExpr(compare)).toBe('a! ==1')
    expect(evaluate(`a=1;${printExpr(compare)}`)).toBe(1)
  })

  test('a negative literal under a factorial keeps the brackets upstream wrote', () => {
    expect(printExpr({ kind: 'factorial', operand: n(-1) })).toBe('(-1)!')
  })

  test('a conditional as a test needs brackets; as a branch it does not', () => {
    const inner: Expr = { kind: 'conditional', test: n(1), then: n(2), otherwise: n(3) }
    expect(printExpr({ kind: 'conditional', test: inner, then: n(4), otherwise: n(5) })).toBe(
      '(1?2:3)?4:5',
    )
    expect(printExpr({ kind: 'conditional', test: n(1), then: inner, otherwise: n(5) })).toBe(
      '1?1?2:3:5',
    )
  })
})

describe('every statement kind round-trips', () => {
  // A partial printer that throws on `while` is a landmine, so each variant is printed
  // at least once. The corpus reaches most of them; `break`, `continue` and the empty
  // statement are here because it does not reach them in isolation.
  const cases: Readonly<Record<string, string>> = {
    expr: 'a=1; a',
    block: 'a=0; { a=1; } a',
    if: 'a=0; if (1) a=2; a',
    'if else': 'a=0; if (0) a=2; else a=3; a',
    'dangling else': 'a=0; if (1) { if (0) a=2; } else a=3; a',
    while: 'c=3; a=0; while (c > 0) { ++a; --c; } a',
    do: 'c=0; a=0; do { ++a; ++c; } while (c < 3); a',
    for: 'a=0; for (i=0; i<4; ++i) { ++a; } a',
    simpleFor: 'y=0; for (i=1,3) { y *= 10; y += i; } y',
    switch: 'x=0; switch (1) { case 1: x=5; break; default: x=7 } x',
    'switch with default in the middle':
      'x=0; switch (2) { case 1: x=5; default: x=7; case 2: x=9 } x',
    break: 'a=0; while (1) { ++a; break; } a',
    continue: 'a=0; for (i=0; i<4; ++i) { continue; a=99; } a',
    return: 'return 7; 0',
    empty: 'a=1;;a',
  }

  for (const [kind, source] of Object.entries(cases)) {
    test(kind, () => {
      expect(evaluate(reprint(source)), reprint(source)).toBe(evaluate(source))
      expect(reprint(reprint(source))).toBe(reprint(source))
    })
  }

  test('an if that would swallow a following else is braced', () => {
    // Unreachable by parsing — `if (1) if (0) a=2; else a=3;` binds the else to the
    // inner if, so no source produces this tree. A compiler building statements does,
    // and printing it without braces silently moves the else one level up.
    const set = (name: string, value: number): Stmt => ({
      kind: 'expr',
      expr: { kind: 'assign', op: '=', name, at: 0, value: { kind: 'number', value } },
    })
    const inner: Stmt = { kind: 'if', test: { kind: 'number', value: 0 }, then: set('a', 2) }
    const outer: Stmt = {
      kind: 'if',
      test: { kind: 'number', value: 1 },
      then: inner,
      otherwise: set('a', 3),
    }
    const printed = printProgram({
      body: [set('a', 0), outer, { kind: 'expr', expr: { kind: 'name', name: 'a', at: 0 } }],
    })

    // Braced, the outer else does not run and `a` stays 0. Unbraced, the else belongs to
    // `if (0)` and runs, making it 3 — a different program that parses just as happily.
    expect(printed).toContain('{')
    expect(evaluate(printed), printed).toBe(0)
  })

  test('a default in the middle stays in the middle, because fallthrough is positional', () => {
    // Moving `default:` to the end still parses and quietly changes what the switch does:
    // here the default runs on the way from case 1 to case 2.
    const source = 'x=1; switch (1) { case 1: x=x*2; default: x=x+10; case 2: x=x*3 } x'
    expect(evaluate(source)).toBe(36)
    expect(evaluate(reprint(source))).toBe(36)
    expect(reprint(source)).toContain('default')
  })
})
