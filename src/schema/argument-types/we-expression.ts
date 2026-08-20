import type { Diagnostic } from '../types'

/**
 * A WorldEdit expression — the formula `//generate` tests each block position against.
 *
 * The language is not parsed here. Parsing it properly means a lexer, a precedence
 * table, control flow and two dozen built-ins, and it belongs in the standalone
 * fixture-tested evaluator the shape preview needs — not in a text field's validator,
 * where a half-implementation would report confident nonsense about a valid formula.
 *
 * So this checks the one class of mistake that is certain rather than probable, and
 * that a reader misses precisely because the expression is dense: brackets that do not
 * close. Everything else is left to the evaluator, and to the server, which reports a
 * parse error the user can read.
 */
const PAIRS: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' }
const OPENERS = new Set(Object.values(PAIRS))

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

export function validateExpression(value: string): Diagnostic[] {
  const stack: string[] = []
  for (const char of value) {
    if (OPENERS.has(char)) {
      stack.push(char)
      continue
    }
    const opener = PAIRS[char]
    if (opener === undefined) continue
    // A closer with nothing open, or closing the wrong kind, is wrong at this
    // character rather than at the end — reporting it here names the real mistake.
    if (stack.pop() !== opener)
      return [warn(`This expression closes a ${char} that was never opened.`)]
  }
  const unclosed = stack.at(-1)
  return unclosed === undefined ? [] : [warn(`This expression leaves a ${unclosed} unclosed.`)]
}
