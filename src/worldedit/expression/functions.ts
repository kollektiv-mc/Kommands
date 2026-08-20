/**
 * The expression language's built-in library.
 *
 * Names and arities are taken from WorldEdit's `Functions.java`. Two groups are
 * deliberately absent and one is deliberately odd:
 *
 * **World reads** — `query`, `queryAbs`, `queryRel`, `getBlockType*` — are gone with
 * world masking (docs/generate-editor.md § Masking). They parse; they do not evaluate.
 *
 * **Noise** — `perlin`, `voronoi`, `ridgedmulti` — comes from `jlibnoise` upstream. An
 * approximation would draw a shape the command does not produce, which is worse than
 * drawing nothing, so these are unimplemented rather than guessed.
 *
 * Both groups are listed in `UNIMPLEMENTED` so the compiler can say *why* a name it
 * recognises does not work, rather than reporting it as a typo.
 */

/** Arity `-1` means variadic. */
export interface BuiltIn {
  arity: number
  apply: (args: number[]) => number
}

const unary = (fn: (x: number) => number): BuiltIn => ({ arity: 1, apply: (a) => fn(a[0]!) })

/** `log` is the natural log here, and `ln` is its documented alias. Not log base 10. */
const MATH: Readonly<Record<string, BuiltIn>> = {
  sin: unary(Math.sin),
  cos: unary(Math.cos),
  tan: unary(Math.tan),
  asin: unary(Math.asin),
  acos: unary(Math.acos),
  atan: unary(Math.atan),
  sinh: unary(Math.sinh),
  cosh: unary(Math.cosh),
  tanh: unary(Math.tanh),
  sqrt: unary(Math.sqrt),
  cbrt: unary(Math.cbrt),
  abs: unary(Math.abs),
  ceil: unary(Math.ceil),
  floor: unary(Math.floor),
  exp: unary(Math.exp),
  log: unary(Math.log),
  log10: unary(Math.log10),
  ln: unary(Math.log),
  // Java's Math.rint rounds half to *even*; JavaScript has no equivalent. Math.round
  // would disagree at every .5, so this is spelled out rather than approximated.
  rint: unary(rint),
  // Java's Math.round is floor(x + 0.5), which differs from JS's Math.round only for
  // negative halves — Math.round(-2.5) is -2 in both, so the plain one is correct here.
  round: unary(Math.round),
  atan2: { arity: 2, apply: (a) => Math.atan2(a[0]!, a[1]!) },
  min: { arity: -1, apply: (a) => Math.min(...a) },
  max: { arity: -1, apply: (a) => Math.max(...a) },
}

/**
 * Round half to even, as `Math.rint` does.
 *
 * `rint(2.5)` is 2 and `rint(3.5)` is 4 — the tie goes to the even neighbour, which is
 * why this cannot be `Math.round`.
 */
function rint(x: number): number {
  const rounded = Math.round(x)
  // Math.round breaks ties upward, so it is only wrong when x was exactly a half and the
  // result it produced is odd.
  if (Math.abs(x % 1) === 0.5 && rounded % 2 !== 0) return rounded - 1
  return rounded
}

const RANDOM: Readonly<Record<string, BuiltIn>> = {
  random: { arity: 0, apply: () => Math.random() },
  // randint(n) is an integer in [0, n).
  randint: { arity: 1, apply: (a) => Math.floor(Math.random() * a[0]!) },
}

export const BUILT_INS: Readonly<Record<string, BuiltIn>> = { ...MATH, ...RANDOM }

/**
 * Names the language has that this evaluator does not implement.
 *
 * The value is the reason, shown to the user. A name that is real but unavailable is a
 * different problem from a name that is misspelled, and telling someone `perlin` is not a
 * function would be a lie.
 */
export const UNIMPLEMENTED: Readonly<Record<string, string>> = {
  query: 'reads blocks already in the world, which this preview does not have',
  queryAbs: 'reads blocks already in the world, which this preview does not have',
  queryRel: 'reads blocks already in the world, which this preview does not have',
  getBlockType: 'reads blocks already in the world, which this preview does not have',
  getBlockTypeAbs: 'reads blocks already in the world, which this preview does not have',
  getBlockTypeRel: 'reads blocks already in the world, which this preview does not have',
  perlin: 'is not implemented yet — its noise has to be ported exactly, not approximated',
  voronoi: 'is not implemented yet — its noise has to be ported exactly, not approximated',
  ridgedmulti: 'is not implemented yet — its noise has to be ported exactly, not approximated',
}

/**
 * `n!`, matching WorldEdit's table.
 *
 * The input is truncated first, so `2.9!` is `2!` — which is 2, and looks like a bug
 * until you know that. Beyond 170 the result exceeds a double and upstream returns
 * infinity; below zero it returns 0 rather than erroring.
 */
const FACTORIALS: readonly number[] = (() => {
  const table = new Array<number>(171)
  table[0] = 1
  for (let i = 1; i < table.length; i++) table[i] = table[i - 1]! * i
  return table
})()

export function factorial(x: number): number {
  // Truncation, not floor: upstream casts to int, so `-0.5!` is `0!` — which is 1, while
  // flooring would make it `(-1)!` — which is 0. The two differ on exactly the numbers
  // where someone would not think to check.
  const n = Math.trunc(x)
  if (n < 0) return 0
  return n < FACTORIALS.length ? FACTORIALS[n]! : Number.POSITIVE_INFINITY
}

/**
 * WorldEdit's `~=`, which compares by how many representable doubles lie between two
 * values rather than by a fixed tolerance.
 *
 * A tolerance-based version gets `1 ~= 0.999999999` right by luck and then disagrees
 * about numbers far from 1, where the gap between neighbouring doubles is much larger.
 * The bound is upstream's, copied rather than derived: `longDiff <= 450359963L`.
 */
const MAX_ULPS = 450_359_963n

const ULP_BUFFER = new DataView(new ArrayBuffer(8))

/** A double reinterpreted as a sign-and-magnitude integer, for counting ULPs. */
function asOrderedBits(value: number): bigint {
  ULP_BUFFER.setFloat64(0, value)
  const bits = ULP_BUFFER.getBigInt64(0)
  // Negative doubles run backwards as raw bits, so they are folded onto the same number
  // line as the positives before subtracting.
  return bits < 0n ? 0x8000000000000000n - bits : bits
}

export function almostEqual(a: number, b: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  if (a === b) return true
  const difference = asOrderedBits(a) - asOrderedBits(b)
  return (difference < 0n ? -difference : difference) <= MAX_ULPS
}
