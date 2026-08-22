import type { Diagnostic } from '../../../schema/types'
import { compileExpression, evaluateGrid } from '../../../worldedit/expression'

/**
 * `//generate`'s expression, as a set of filled positions.
 *
 * Headless on purpose, and the reason this module is testable at all: jsdom has no
 * WebGL, so anything that only exists inside a canvas is untestable here. Everything
 * interesting — what the formula fills, and what `-h` removes — happens in this file
 * and is asserted against fixtures. `ShapePreview.tsx` beside it only draws the result.
 */

export interface VoxelField {
  /** Samples per axis. `x`, `y` and `z` run −1..1 across them. */
  size: number
  /** 1 where a block is placed. Indexed `ix + iy * size + iz * size²`. */
  filled: Uint8Array
  /** How many positions are filled, so a caller need not count them again. */
  count: number
}

export type ShapeResult =
  | { ok: true; field: VoxelField; diagnostics: Diagnostic[] }
  /** Nothing to draw, and why. Never an error: the command still generates. */
  | { ok: false; reason: string; diagnostics: Diagnostic[] }

/**
 * The evaluated volume is capped, and the cap is the caller's to surface.
 *
 * `docs/health-checklist.md` § 4 asks for both halves — a cap, *and* the cap said out
 * loud rather than the shape quietly shrinking. 64 per axis is 262,144 evaluations,
 * which the benchmarks put at ~56 ms for a torus and ~196 ms for a gyroid; past that
 * the tab stops feeling like it is responding to typing.
 */
export const MAX_SIZE = 64
export const DEFAULT_SIZE = 32

export function clampSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_SIZE
  return Math.min(MAX_SIZE, Math.max(1, Math.trunc(size)))
}

/**
 * Evaluate an expression into a voxel field.
 *
 * Never throws. A formula that does not parse, one that runs past its step budget, and
 * an empty field are all `ok: false` with a reason — the command is the product and it
 * generates either way, per `.claude/rules/previews.md`.
 */
export function shapeVoxels(source: string, size: number, hollow: boolean): ShapeResult {
  if (source.trim() === '') {
    return { ok: false, reason: 'Enter an expression to see the shape.', diagnostics: [] }
  }

  const compiled = compileExpression(source)
  if (!compiled.ok) {
    return {
      ok: false,
      reason: 'This formula does not parse yet.',
      diagnostics: compiled.diagnostics,
    }
  }

  const span = clampSize(size)
  // Hollow reads one layer beyond the region, so it has to be evaluated there too.
  const grid = evaluateGrid(compiled.expression, span, { pad: hollow ? 1 : 0 })
  if ('failure' in grid) {
    return { ok: false, reason: grid.failure, diagnostics: compiled.diagnostics }
  }

  const solid = interior(grid.filled, grid.span, grid.pad, span)
  const field = hollow ? shell(grid.filled, grid.span, grid.pad, span) : solid

  if (field.count === 0) {
    return {
      ok: false,
      reason: nothingDrawn(solid.count, compiled.diagnostics),
      diagnostics: compiled.diagnostics,
    }
  }

  return { ok: true, field, diagnostics: compiled.diagnostics }
}

/**
 * Why there is nothing on screen — which is not always a fact about the command.
 *
 * Three different situations, and conflating them tells the user something false. The
 * `perlin` case is the one that matters: it evaluates to zero here *because this
 * preview has not ported jlibnoise*, and `//generate stone perlin(...) > 0` places
 * blocks perfectly well in game. Reporting that as "the formula is never true" would be
 * the preview asserting something about the command that is not so.
 */
function nothingDrawn(solidCount: number, diagnostics: readonly Diagnostic[]): string {
  if (solidCount > 0) {
    // True everywhere, so no position has a neighbour outside the shape. WorldEdit's
    // `getMaterial` returns null for every one of them too — this is the command's
    // behaviour, not a limit of the preview.
    return 'Every filled position is surrounded, so -h leaves nothing. WorldEdit places nothing here either.'
  }
  if (diagnostics.length > 0) {
    return 'This preview cannot evaluate part of the formula, so it has nothing to draw. The command is unaffected.'
  }
  return 'The formula is never true in this selection, so nothing would be placed.'
}

/** Without `-h`: every position the expression filled is a position that gets a block. */
function interior(filled: Uint8Array, gridSpan: number, pad: number, size: number): VoxelField {
  if (pad === 0) {
    let count = 0
    for (let i = 0; i < filled.length; i++) if (filled[i] === 1) count++
    return { size, filled, count }
  }

  // Padded — the ring exists for `shell`, and is not part of the region.
  const out = new Uint8Array(size * size * size)
  let count = 0
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        const at = ix + pad + (iy + pad) * gridSpan + (iz + pad) * gridSpan * gridSpan
        if (filled[at] !== 1) continue
        out[ix + iy * size + iz * size * size] = 1
        count++
      }
    }
  }
  return { size, filled: out, count }
}

/**
 * `-h`, as WorldEdit actually implements it.
 *
 * Read out of `ArbitraryShape.getMaterial` rather than assumed. A filled position keeps
 * its block if **any one of its six axis neighbours** is outside the shape:
 *
 *     if (isOutsideCached(x + 1, y, z, pattern)) return material;
 *     … x − 1, z ± 1, y ± 1 …
 *     return null;
 *
 * Six-neighbour, not twenty-six — a diagonal neighbour does not open a shell.
 *
 * The subtlety that makes the padding necessary: WorldEdit's cache spans one layer
 * beyond the region (`cacheOffsetX = min.x() - 1`, `cacheSizeX = max.x() - cacheOffsetX
 * + 2`) and *evaluates the expression there*. So a neighbour past the edge is outside
 * the shape only if the formula says so. A shape that fills the selection to its face
 * is therefore **not** shelled at that face, and an implementation treating "off the
 * grid" as "outside" would put a wall there that the command does not place.
 */
function shell(filled: Uint8Array, gridSpan: number, pad: number, size: number): VoxelField {
  const out = new Uint8Array(size * size * size)
  const at = (x: number, y: number, z: number): number =>
    filled[x + y * gridSpan + z * gridSpan * gridSpan] ?? 0

  let count = 0
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        const x = ix + pad
        const y = iy + pad
        const z = iz + pad
        if (at(x, y, z) !== 1) continue

        const exposed =
          at(x + 1, y, z) !== 1 ||
          at(x - 1, y, z) !== 1 ||
          at(x, y, z + 1) !== 1 ||
          at(x, y, z - 1) !== 1 ||
          at(x, y + 1, z) !== 1 ||
          at(x, y - 1, z) !== 1

        if (exposed) {
          out[ix + iy * size + iz * size * size] = 1
          count++
        }
      }
    }
  }

  return { size, filled: out, count }
}
