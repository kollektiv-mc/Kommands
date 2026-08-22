import type { Diagnostic } from '../../schema/types'
import { compileProgram, StepLimitExceeded, type CompileOptions } from './compile'
import { parse } from './parse'

export type { CompiledExpression } from './compile'
export { StepLimitExceeded } from './compile'

/**
 * The WorldEdit expression language, compiled.
 *
 * `//generate` runs its expression once per position in the selection and places a block
 * where the result is greater than zero. This is that language, so a preview can show
 * what a command will do before anyone runs it — and so the expression field can say
 * what is wrong with a formula instead of only counting brackets.
 *
 * Ported from WorldEdit's `internal/expression/`, and tested against its own fixtures.
 * What this does *not* implement is deliberate and listed in `functions.ts`: the
 * world-reading functions, which went with world masking, and the noise functions, which
 * need an exact port rather than an approximation.
 *
 * See docs/generate-editor.md for how it fits the editor.
 */

export type CompileResult =
  | { ok: true; expression: import('./compile').CompiledExpression; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] }

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

/**
 * Compile an expression, or say what is wrong with it.
 *
 * Never throws. Parse failures make the result `ok: false`; a source that parses but uses
 * something unavailable — `perlin`, `query` — still compiles, with diagnostics saying so,
 * because the command it produces is perfectly valid in game even though this cannot
 * preview it. That distinction is the whole reason `ok` and `diagnostics` are separate.
 */
export function compileExpression(source: string, options: CompileOptions = {}): CompileResult {
  const { program, errors } = parse(source)
  if (errors.length > 0) {
    return { ok: false, diagnostics: errors.map((e) => warn(e.message)) }
  }

  const { expression, issues } = compileProgram(program, options)
  return { ok: true, expression, diagnostics: issues.map((i) => warn(i.message)) }
}

/**
 * Everything wrong with an expression, as warnings.
 *
 * The shape an argument type's `validate` wants: a flat list, empty when the source is
 * fine. Blank input is not an error — an unfilled required argument is already reported
 * as a gap by the serializer, and saying it twice helps nobody.
 */
export function expressionDiagnostics(source: string): Diagnostic[] {
  if (source.trim() === '') return []
  const result = compileExpression(source)
  return result.diagnostics
}

export interface GridOptions {
  /**
   * Extra sample layers evaluated **outside** the region, on every face.
   *
   * The step stays the one `size` implies, so padding widens the sampled box rather
   * than stretching the shape inside it. Hollow needs exactly this: WorldEdit's
   * `ArbitraryShape` pads its cache by one layer (`cacheOffsetX = min.x() - 1`) and
   * evaluates the expression there, so a neighbour beyond the region is *outside the
   * shape only if the formula says so* — not merely because it left the box. Without
   * the ring, a shape reaching the selection edge gets shelled at that edge, which
   * WorldEdit does not do.
   */
  pad?: number
}

export interface Grid {
  /** 1 where the expression is greater than zero. Indexed `ix + iy * span + iz * span²`. */
  filled: Uint8Array
  /** The `data` slot each filled position left behind, same indexing. */
  data: Float64Array
  /** Samples per axis, padding included: `size + 2 * pad`. */
  span: number
  /** How many of those layers sit outside the region on each face. */
  pad: number
}

/**
 * Evaluate across a grid, for a preview.
 *
 * `x`, `y` and `z` run −1..1 across the region, matching `//generate`'s default origin
 * mode. Returns the set of filled positions and the `data` each carries, or the reason it
 * could not finish.
 *
 * The caller owns the cap: `size` is the number of samples per axis, and
 * `docs/health-checklist.md` requires whatever chooses it to surface that choice in the
 * UI rather than quietly shrinking the shape.
 */
export function evaluateGrid(
  expression: import('./compile').CompiledExpression,
  size: number,
  options: GridOptions = {},
): Grid | { failure: string } {
  const pad = Math.max(0, Math.trunc(options.pad ?? 0))
  const span = size + 2 * pad
  const total = span * span * span
  const filled = new Uint8Array(total)
  const data = new Float64Array(total)
  const step = size > 1 ? 2 / (size - 1) : 0

  // A single sample sits at the origin, and padding it would put the extra layers at
  // the same point. Keeping `at` centred there is what makes size 1 mean "one sample"
  // rather than "a degenerate box".
  const at = (i: number): number => (size > 1 ? -1 + (i - pad) * step : 0)

  try {
    let index = 0
    for (let iz = 0; iz < span; iz++) {
      const z = at(iz)
      for (let iy = 0; iy < span; iy++) {
        const y = at(iy)
        for (let ix = 0; ix < span; ix++, index++) {
          const x = at(ix)
          if (expression.evaluate(x, y, z) > 0) {
            filled[index] = 1
            data[index] = expression.slot('data')
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof StepLimitExceeded) return { failure: error.message }
    throw error
  }

  return { filled, data, span, pad }
}
