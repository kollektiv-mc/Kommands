/**
 * The shape of a parsed expression.
 *
 * Deliberately a plain discriminated union with no methods: `compile.ts` turns it into
 * closures once, and nothing walks it per voxel. Keeping behaviour off the nodes is what
 * makes that separation hard to erode.
 */

export type BinaryOperator =
  '+' | '-' | '*' | '/' | '%' | '^' | '<<' | '>>' | '==' | '!=' | '~=' | '<' | '<=' | '>' | '>='

/** Compound assignment, keyed by the operator it applies before storing. */
export type AssignOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '^='

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'name'; name: string; at: number }
  | { kind: 'unary'; op: '-' | '+' | '!' | '~'; operand: Expr }
  /** Postfix `!`. Factorial, not negation — see lex.ts. */
  | { kind: 'factorial'; operand: Expr }
  | { kind: 'binary'; op: BinaryOperator; left: Expr; right: Expr }
  /**
   * `&&` and `||`, which are not binary operators in any useful sense: they
   * short-circuit, and they return the *operand*, not a boolean. Separating them from
   * `binary` is what stops that being quietly forgotten in the compiler.
   */
  | { kind: 'logical'; op: '&&' | '||'; left: Expr; right: Expr }
  | { kind: 'conditional'; test: Expr; then: Expr; otherwise: Expr }
  | { kind: 'assign'; op: AssignOperator; name: string; at: number; value: Expr }
  /** `++x` / `--x` and `x++` / `x--`; `prefix` decides which value is produced. */
  | { kind: 'crement'; op: '++' | '--'; name: string; at: number; prefix: boolean }
  | { kind: 'call'; name: string; at: number; args: Expr[] }

export type Stmt =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'block'; body: Stmt[] }
  | { kind: 'if'; test: Expr; then: Stmt; otherwise?: Stmt }
  | { kind: 'while'; test: Expr; body: Stmt }
  | { kind: 'do'; body: Stmt; test: Expr }
  | { kind: 'for'; init: Expr; test: Expr; update: Expr; body: Stmt }
  /** `for (i = first, last) body` — WorldEdit's range form, not a C loop. */
  | { kind: 'simpleFor'; counter: string; at: number; first: Expr; last: Expr; body: Stmt }
  /**
   * `fallbackAt` is where `default:` sat among the cases, because fallthrough is
   * positional: `case 1: … default: … case 2: …` runs the default on its way from 1 to 2.
   */
  | { kind: 'switch'; target: Expr; cases: SwitchCase[]; fallback?: Stmt[]; fallbackAt: number }
  | { kind: 'break' }
  | { kind: 'continue' }
  | { kind: 'return'; value: Expr }
  | { kind: 'empty' }

export interface SwitchCase {
  /** Case labels are constant expressions, folded at parse time. */
  value: number
  body: Stmt[]
}

/** A whole expression source: a sequence of statements, the last one's value the result. */
export interface Program {
  body: Stmt[]
}
