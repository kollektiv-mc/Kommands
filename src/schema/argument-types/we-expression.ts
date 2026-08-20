import type { Diagnostic } from '../types'
import { expressionDiagnostics } from '../../worldedit/expression'

/**
 * A WorldEdit expression — the formula `//generate` tests each block position against.
 *
 * This used to balance brackets and stop, because the alternative was "a lexer, a
 * precedence table, control flow and two dozen built-ins" and a half-implementation would
 * have reported confident nonsense about valid formulas. That evaluator now exists in
 * `src/worldedit/expression/`, tested against WorldEdit's own fixtures, so the field can
 * say what is actually wrong instead of counting punctuation.
 *
 * It still only ever warns. An expression someone is halfway through typing is the normal
 * case, and the command is generated either way.
 */
export function validateExpression(value: string): Diagnostic[] {
  return expressionDiagnostics(value)
}
