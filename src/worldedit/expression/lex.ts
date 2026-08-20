/**
 * The WorldEdit expression language, tokenised.
 *
 * Transcribed from `Expression.g4` in WorldEdit — 50 lexer tokens. The grammar is the
 * specification; this file is not free to be tidier than it. Two token spellings look
 * like mistakes and are not:
 *
 *   `^` and `**` are the *same* token, and it is POWER, not xor.
 *   `!` is both prefix negation and postfix factorial, told apart by position.
 *
 * See docs/generate-editor.md for where the language sits, and `parse.ts` for the
 * precedence it feeds.
 */

export type TokenKind =
  // Literals and names
  | 'number'
  | 'id'
  // Grouping and separators
  | '('
  | ')'
  | '{'
  | '}'
  | ';'
  | ','
  | '?'
  | ':'
  // Arithmetic
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '<<'
  | '>>'
  | '~'
  // Comparison
  | '=='
  | '!='
  | '~='
  | '<'
  | '<='
  | '>'
  | '>='
  // Logical
  | '&&'
  | '||'
  | '!'
  // Assignment
  | '='
  | '+='
  | '-='
  | '*='
  | '/='
  | '%='
  | '^='
  // Increment
  | '++'
  | '--'
  // Keywords
  | 'if'
  | 'else'
  | 'while'
  | 'do'
  | 'for'
  | 'break'
  | 'continue'
  | 'return'
  | 'switch'
  | 'case'
  | 'default'
  | 'eof'

export interface Token {
  kind: TokenKind
  /** The source text. For a number this is what was written, not what it parses to. */
  text: string
  /** Character offset of the token's first character, for diagnostics. */
  at: number
}

export interface LexFailure {
  at: number
  message: string
}

const KEYWORDS = new Set([
  'if',
  'else',
  'while',
  'do',
  'for',
  'break',
  'continue',
  'return',
  'switch',
  'case',
  'default',
])

/**
 * Operator spellings, longest first.
 *
 * Order is the whole of the matching rule: `<<` must be tried before `<`, `**` before
 * `*`, `^=` before `^`. Sorting by length at module load rather than by hand means a
 * spelling added later cannot be shadowed by a shorter prefix of itself.
 */
const OPERATORS: readonly (readonly [string, TokenKind])[] = (
  [
    ['**', '^'],
    ['<<', '<<'],
    ['>>', '>>'],
    ['==', '=='],
    ['!=', '!='],
    ['~=', '~='],
    ['<=', '<='],
    ['>=', '>='],
    ['&&', '&&'],
    ['||', '||'],
    ['++', '++'],
    ['--', '--'],
    ['+=', '+='],
    ['-=', '-='],
    ['*=', '*='],
    ['/=', '/='],
    ['%=', '%='],
    ['^=', '^='],
    ['(', '('],
    [')', ')'],
    ['{', '{'],
    ['}', '}'],
    [';', ';'],
    [',', ','],
    ['?', '?'],
    [':', ':'],
    ['+', '+'],
    ['-', '-'],
    ['*', '*'],
    ['/', '/'],
    ['%', '%'],
    ['^', '^'],
    ['~', '~'],
    ['<', '<'],
    ['>', '>'],
    ['!', '!'],
    ['=', '='],
  ] as const satisfies readonly (readonly [string, TokenKind])[]
)
  .slice()
  .sort((a, b) => b[0].length - a[0].length)

const isDigit = (c: string): boolean => c >= '0' && c <= '9'
const isIdStart = (c: string): boolean => /[A-Za-z]/.test(c)
const isIdPart = (c: string): boolean => /[0-9A-Za-z_]/.test(c)

/**
 * Tokenise, or say where it went wrong.
 *
 * Returns a failure rather than throwing, because everything downstream of this reports
 * diagnostics and the one thing an expression field must not do is blank the page.
 */
export function lex(source: string): { tokens: Token[] } | { failure: LexFailure } {
  const tokens: Token[] = []
  let i = 0

  while (i < source.length) {
    const c = source[i]!

    // The grammar skips [ \t\r\n\f]. A newline is whitespace like any other: the
    // variadic argument joins its tokens with spaces, so an expression is one line by
    // the time it reaches a command, but the field it is typed into is a textarea.
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f') {
      i++
      continue
    }

    // NUMBER: ( DIGIT+ DECIMAL? | DECIMAL ) EXPONENT?
    if (isDigit(c) || (c === '.' && isDigit(source[i + 1] ?? ''))) {
      const start = i
      while (isDigit(source[i] ?? '')) i++
      if (source[i] === '.') {
        i++
        while (isDigit(source[i] ?? '')) i++
      }
      if (source[i] === 'e' || source[i] === 'E') {
        const beforeExponent = i
        i++
        if (source[i] === '+' || source[i] === '-') i++
        if (isDigit(source[i] ?? '')) {
          while (isDigit(source[i] ?? '')) i++
        } else {
          // `2e` is the number 2 followed by the name `e`, which is a real constant in
          // this language. Rewinding is what makes `2e` mean 2×e rather than a
          // malformed exponent.
          i = beforeExponent
        }
      }
      tokens.push({ kind: 'number', text: source.slice(start, i), at: start })
      continue
    }

    // ID : [A-Za-z] [0-9A-Za-z_]*  — and the keywords are IDs that got reserved.
    if (isIdStart(c)) {
      const start = i
      while (isIdPart(source[i] ?? '')) i++
      const text = source.slice(start, i)
      tokens.push({ kind: KEYWORDS.has(text) ? (text as TokenKind) : 'id', text, at: start })
      continue
    }

    const operator = OPERATORS.find(([spelling]) => source.startsWith(spelling, i))
    if (operator) {
      tokens.push({ kind: operator[1], text: operator[0], at: i })
      i += operator[0].length
      continue
    }

    return { failure: { at: i, message: `${c} does not mean anything here.` } }
  }

  tokens.push({ kind: 'eof', text: '', at: source.length })
  return { tokens }
}
