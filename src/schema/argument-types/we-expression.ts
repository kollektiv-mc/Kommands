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
export function validateExpression(value: ExpressionValue): Diagnostic[] {
  return expressionDiagnostics(expressionSource(value))
}

/**
 * An expression as text, or as text with the 3D editor's layers it was compiled from.
 *
 * The layers ride along so the editor can open the command again where it left off
 * (`docs/generate-editor.md` § The decision: the document is the truth and the command
 * a projection of it). They are `unknown` here because what a layer is belongs to the
 * editor, not to the schema; the editor narrows them when it opens, and a value saved
 * by an older or newer editor that it cannot read opens as its text instead. The
 * source is stored rather than recompiled on every serialize, so writing a command
 * costs what it always did.
 *
 * Typing into the field writes plain text, which leaves the layers behind; undo brings
 * them back.
 */
export type ExpressionValue = string | DrawnExpression

export interface DrawnExpression {
  readonly source: string
  readonly layers: unknown
}

export function isDrawn(value: unknown): value is DrawnExpression {
  return (
    typeof value === 'object' &&
    value !== null &&
    'source' in value &&
    typeof value.source === 'string' &&
    'layers' in value
  )
}

/** The expression's text, whichever form it is held in. */
export function expressionSource(value: unknown): string {
  if (typeof value === 'string') return value
  return isDrawn(value) ? value.source : ''
}
