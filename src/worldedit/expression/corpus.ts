/**
 * WorldEdit's own test suite, as data.
 *
 * `ExpressionTest.java` and `RealExpressionTest.java` are the specification for this
 * language — there is no written one — so these are transcribed rather than invented,
 * and a case that disagrees with upstream is this implementation being wrong, not the
 * case. `expression.test.ts` reads them to check the evaluator; `print.test.ts` reads
 * the same sources to check that printing an AST and parsing it back is the identity.
 *
 * They live here rather than inside `expression.test.ts` because two suites need them
 * and a test file cannot be imported for its data: importing one re-runs its
 * `describe`/`test` registrations in the importing file, silently doubling the suite.
 *
 * This is a plain data module — no framework, no assertions. The narrative about what
 * each group is *for* stays in `expression.test.ts`, which is the file someone opens
 * to learn the language's traps.
 */

/**
 * Source → the number it evaluates to at the origin.
 *
 * Keyed by the `describe` group that consumes it, so a rename is a type error rather
 * than a silently dropped group of tests.
 */
export const SPEC_CASES = {
  'arithmetic and precedence': {
    '1 - 2 + 3': 2,
    '2 + +4': 6,
    '2 - -4': 6,
    '2 * -4': -8,
    '3+1': 4,
  },

  '~ is integer complement, and truncates first': {
    '~0': -1,
    '~1': -2,
    '~-1': 0,
    '~-2': 1,
    // ~0.1, ~0.5 and ~1.9 are ~0, ~0 and ~1 — toward zero, not toward -infinity.
    '~0.1': -1,
    '~0.5': -1,
    '~1.9': -2,
  },

  '<< and >> shift as integers': {
    '1<<4': 16,
    // Both operands are truncated, so this is 1<<4 and not 2<<4.
    '1.1<<4.1': 16,
    '16>>2': 4,
    '16.9>>2.1': 4,
  },

  'min and max take any number of arguments': {
    'min(1, 2)': 1,
    'max(1, 2)': 2,
    'max(1, 2, 3, 4, 5)': 5,
  },

  'the maths built-ins are the platform ones': {
    'sin(5)': Math.sin(5),
    'atan2(3, 4)': Math.atan2(3, 4),
  },

  '&& and || return an operand, not a boolean': {
    '0 || 5': 5,
    '2 || 5': 2,
    '2 && 5': 5,
    '5 && 0': 0,
  },

  'the conditional operator, including nested': {
    'false ? 1 : 2': 2,
    'true ? 1 : 2': 1,
    'true ? true ? 1 : 2 : 3': 1,
    'true ? false ? 1 : 2 : 3': 2,
    'false ? true ? 1 : 2 : 3': 3,
    'false ? false ? 1 : 2 : 3': 3,
  },

  'unary not treats any non-zero as true': { '!0': 1, '!1': 0, '!2': 0, '!-1': 0, '!-2': 0 },

  comparison: {
    '1>=0': 1,
    '1>0': 1,
    '0>=0': 1,
    '0>0': 0,
    '0<=1': 1,
    '0<1': 1,
    '0<=0': 1,
    '0<0': 0,
    '1>=2': 0,
    '1>2': 0,
    '0>=1': 0,
    '0>1': 0,
    '2<=1': 0,
    '2<1': 0,
    '1<=0': 0,
    '1<0': 0,
    '1==1': 1,
    '0==1': 0,
    '1==0': 0,
    '1!=1': 0,
    '0!=1': 1,
    '1!=0': 1,
    '1.1==1.1': 1,
  },

  '~= compares by units in the last place, not by a tolerance': {
    '1!=0.999999999': 1,
    '1~=0.999999999': 1,
    '1~=0.9': 0,
  },

  'postfix ! is factorial': {
    '0!': 1,
    '1!': 1,
    '2!': 2,
    // Truncated, not rounded: 2! rather than 3!.
    '2.9!': 2,
    // Negative is zero rather than an error, which is upstream's choice.
    '(-1)!': 0,
    // Past 170 the result leaves a double, and upstream returns infinity rather than
    // erroring. This is the arm of the table that the smaller cases never reach.
    '2000!': Number.POSITIVE_INFINITY,
  },

  'assignment, sequencing, and the last value as the result': {
    'a=2; a^=3; a': 8,
    'a=2; a*=3; a': 6,
    'a=2; a/=2; a': 1,
    'a=2; a%=3; a': 2,
    'a=2; a+=3; a': 5,
    'a=2; a-=3; a': -1,
  },

  'increment and decrement, before and after': {
    'a=0; b=a++; a+b': 1,
    'a=0; b=++a; a+b': 2,
    'a=0; b=a--; a+b': -1,
    'a=0; b=--a; a+b': -2,
  },

  'return leaves immediately': { 'return 1; 0': 1 },

  'control flow': {
    'y=0; if (1) x=4; else y=5; x*10+y;': 40,
    'x=0; if (0) x=4; else y=5; x*10+y;': 5,
    'c=5; a=0; while (c > 0) { ++a; --c; } a': 5,
    'c=5; a=0; do { ++a; --c; } while (c > 0); a': 5,
    'a=0; for (i=0; i<5; ++i) { ++a; } a': 5,
    // WorldEdit's range form: `for (counter = first, last)`, inclusive.
    'y=0; for (i=1,5) { y *= 10; y += i; } y': 12345,
  },

  'the megabuf scratch store': {
    'megabuf(0, 7); megabuf(0)': 7,
    'gmegabuf(3, 9); gmegabuf(3)': 9,
    // Never written, so zero rather than undefined.
    'megabuf(42)': 0,
    // Upstream indexes with `(int) index`, so these are one cell and not two.
    'megabuf(1, 5); megabuf(1.9)': 5,
  },
} as const satisfies Record<string, Record<string, number>>

export interface ShapeCase {
  /** The test name, and how the shape is known. */
  name: string
  source: string
  /** `[x, y, z, filled]` — filled is 1 where a block is placed. */
  points: ReadonlyArray<readonly [number, number, number, number]>
  /** Why this fixture is here, where that is not obvious from the source. */
  note?: string
}

/**
 * Real `//generate` shapes, from `RealExpressionTest.java`.
 *
 * These are the ones that matter: a torus that is subtly wrong is the failure mode this
 * whole product exists to avoid, and a per-point expectation catches it where a smoke
 * test would not. They are also the best precedence coverage in the corpus — deep,
 * real expressions rather than scalar arithmetic.
 */
export const SHAPE_CASES: readonly ShapeCase[] = [
  {
    name: 'torus',
    source: '(0.75-sqrt(x^2+y^2))^2+z^2 < 0.25^2',
    points: [
      [0, 0, 0, 0],
      [0.5, 0.5, 0.5, 0],
      [1, 0, 0, 0],
      [0.5, 0.5, 0, 1],
      [0.75, 0.5, 0, 1],
      [0.75, 0, 0, 1],
    ],
  },
  {
    name: 'gnarled oak tree',
    source: '(0.5+sin(atan2(x,z)*8)*0.2)*(sqrt(x*x+z*z)/0.5)^(-2)-1.2 < y',
    note: 'The last pair pins the boundary: one ten-thousandth apart, either side of it.',
    points: [
      [-1, -1, -1, 1],
      [-1, 0, 1, 1],
      [1, 1, 1, 1],
      [0, 0, -1, 1],
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0.32274, 0],
      [0, 0, 0.32275, 1],
    ],
  },
  {
    name: 'gyroid',
    source: 'sin(x*6)*cos(y*6)+sin(y*6)*cos(z*6)+sin(z*6)*cos(x*6) < 0.2',
    note:
      'Named in #11 alongside sphere and torus. A triply-periodic minimal surface: it is ' +
      'the fixture that exercises six trigonometric calls per point, and the one where a ' +
      'precedence mistake shows as a plausible-looking but wrong lattice rather than as ' +
      'an obviously broken shape.',
    points: [
      [0, 0, 0, 1],
      [0.5, 0.5, 0.5, 1],
      [-0.5, 0.5, -0.5, 1],
      [0.3, 0, 0, 0],
      [0.25, 0.25, 0, 0],
      [0.2, 0.2, 0.2, 0],
    ],
  },
  {
    name: 'heart',
    source: '(z/2)^2+x^2+(5*y/4-sqrt(abs(x)))^2<0.6',
    points: [
      [0, 0, -1, 1],
      [0, 1, -1, 0],
      [-0.5, 1, 0, 1],
    ],
  },
  {
    name: 'sine wave',
    source: 'sin(x*5)/2<y',
    note: 'Six points, in pairs one hundred-thousandth apart, straddling the surface.',
    points: [
      [1, -0.47947, 0, 0],
      [1, -0.47946, 0, 1],
      [2, -0.27202, 0, 0],
      [2, -0.27201, 0, 1],
      [3, 0.32513, 0, 0],
      [3, 0.32515, 0, 1],
    ],
  },
  {
    name: 'radial cosine',
    source: 'cos(sqrt(x^2+z^2)*5)/2<y',
    points: [
      [0, 0.5, 0, 0],
      [0, 0.51, 0, 1],
      [Math.PI / 5, -0.5, 0, 0],
      [Math.PI / 5, -0.49, 0, 1],
      [Math.PI / 10, 0, 0, 0],
      [Math.PI / 10, 0.1, 0, 1],
    ],
  },
  {
    name: 'circular hyperboloid',
    source: '-(z^2/12)+(y^2/4)-(x^2/12)>-0.03',
    note:
      'The one upstream shape that leads with a negated power. It is written `-(z^2/12)` ' +
      'with the parentheses, which is why it reads the same under either associativity — ' +
      'and is a fair hint that upstream knows `-z^2/12` would not mean what it looks like.',
    points: [
      [0, 0, 0, 1],
      [0, 1, 0, 1],
      [0, 1, 1, 1],
      [1, 1, 1, 1],
      [0, 0, 1, 0],
      [1, 0, 1, 0],
    ],
  },
]
