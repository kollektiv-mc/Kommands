import { describe, expect, test } from 'vitest'
import { clampSize, MAX_SIZE, shapeVoxels, type VoxelField } from './voxels'

/**
 * What `//generate` fills, and what `-h` removes.
 *
 * The whole of the shape module's meaning lives here, deliberately: jsdom has no WebGL,
 * so a design that computed geometry inside the canvas component would be a design that
 * could not be tested. `ShapePreview.tsx` only draws what this returns.
 *
 * The hollow cases are checked against WorldEdit's `ArbitraryShape.getMaterial` rather
 * than against what seems reasonable, because the reasonable answer is wrong twice over:
 * the neighbourhood is six-connected rather than twenty-six, and a neighbour beyond the
 * region is evaluated rather than assumed to be outside.
 */

const at = (field: VoxelField, x: number, y: number, z: number): number =>
  field.filled[x + y * field.size + z * field.size * field.size] ?? 0

const filledOf = (source: string, size: number, hollow: boolean): VoxelField => {
  const result = shapeVoxels(source, size, hollow)
  if (!result.ok) throw new Error(`expected a shape, got: ${result.reason}`)
  return result.field
}

describe('a formula becomes a set of filled positions', () => {
  test('a sphere fills its inside and nothing else', () => {
    const field = filledOf('x^2+y^2+z^2 < 1', 8, false)
    expect(field.size).toBe(8)
    expect(field.count).toBeGreaterThan(0)

    // Every filled position satisfies the formula, and every empty one does not — the
    // check that the grid indexing and the coordinate mapping agree.
    const step = 2 / 7
    for (let iz = 0; iz < 8; iz++) {
      for (let iy = 0; iy < 8; iy++) {
        for (let ix = 0; ix < 8; ix++) {
          const [x, y, z] = [-1 + ix * step, -1 + iy * step, -1 + iz * step]
          const inside = x * x + y * y + z * z < 1
          expect(at(field, ix, iy, iz) === 1).toBe(inside)
        }
      }
    }
  })

  test('an empty expression is not an error — there is simply nothing to draw', () => {
    const result = shapeVoxels('   ', 8, false)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.diagnostics).toEqual([])
  })

  test('a formula that does not parse reports why, and never throws', () => {
    const result = shapeVoxels('x^2+ < ', 8, false)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.diagnostics.length).toBeGreaterThan(0)
  })

  test('a formula that is never true says so rather than drawing an empty box', () => {
    const result = shapeVoxels('0', 8, false)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('never true')
  })

  test('a function this preview cannot draw still compiles, and says which', () => {
    // The evaluator's own honesty, carried through. The command generates either way —
    // it is only the preview that cannot show it.
    const result = shapeVoxels('perlin(x, y, z, 1, 1, 1) > 0', 6, false)
    expect(result.diagnostics.map((d) => d.message).join(' ')).toContain('perlin')
  })

  test('an unimplemented function is not reported as a formula that is never true', () => {
    // The distinction that keeps the preview from lying about the command. `perlin`
    // evaluates to zero here because jlibnoise has not been ported; in game the same
    // command places blocks. Saying "never true" would be a claim about //generate.
    const result = shapeVoxels('perlin(x, y, z, 1, 1, 1) > 0', 6, false)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).not.toContain('never true')
    expect(result.ok === false && result.reason).toContain('command is unaffected')
  })

  test('a loop that does not terminate reports the step budget instead of hanging', () => {
    const result = shapeVoxels('while (1) { x; } 1', 4, false)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('did not finish')
  })
})

describe('-h shells the shape the way WorldEdit does', () => {
  test('the shell is a strict subset of the solid, and smaller', () => {
    const solid = filledOf('x^2+y^2+z^2 < 1', 12, false)
    const shell = filledOf('x^2+y^2+z^2 < 1', 12, true)

    expect(shell.count).toBeLessThan(solid.count)
    expect(shell.count).toBeGreaterThan(0)
    for (let i = 0; i < solid.filled.length; i++) {
      if (shell.filled[i] === 1) expect(solid.filled[i]).toBe(1)
    }
  })

  test('a position is kept when any one of its six axis neighbours is outside', () => {
    // Six-connected, not twenty-six. A diagonal neighbour does not open a shell, so a
    // solid whose only outside neighbours are diagonal keeps its interior.
    const shell = filledOf('x^2+y^2+z^2 < 1', 12, true)
    const solid = filledOf('x^2+y^2+z^2 < 1', 12, false)

    for (let iz = 1; iz < 11; iz++) {
      for (let iy = 1; iy < 11; iy++) {
        for (let ix = 1; ix < 11; ix++) {
          if (at(solid, ix, iy, iz) !== 1) continue
          const exposed =
            at(solid, ix + 1, iy, iz) !== 1 ||
            at(solid, ix - 1, iy, iz) !== 1 ||
            at(solid, ix, iy + 1, iz) !== 1 ||
            at(solid, ix, iy - 1, iz) !== 1 ||
            at(solid, ix, iy, iz + 1) !== 1 ||
            at(solid, ix, iy, iz - 1) !== 1
          expect(at(shell, ix, iy, iz) === 1).toBe(exposed)
        }
      }
    }
  })

  test('a shape reaching the region face is not shelled at that face', () => {
    // The case a naive implementation gets wrong, and the reason evaluateGrid grew a
    // `pad` option. `y < 0` fills the bottom half and keeps going past every side of
    // the selection, so the only surface inside the region is the top of the slab.
    // Treating "off the grid" as "outside the shape" would wrap it in five extra walls.
    const shell = filledOf('y < 0', 8, true)

    // y = -1 + iy * (2/7): true for iy 0..3, false from iy 4. Only iy 3 is exposed.
    expect(shell.count).toBe(8 * 8)
    for (let iz = 0; iz < 8; iz++) {
      for (let ix = 0; ix < 8; ix++) {
        expect(at(shell, ix, 3, iz)).toBe(1)
        for (const iy of [0, 1, 2, 4, 5, 6, 7]) expect(at(shell, ix, iy, iz)).toBe(0)
      }
    }
  })

  test('a formula true everywhere leaves nothing under -h, as in game', () => {
    // Nothing has a neighbour outside the shape, so `getMaterial` returns null for every
    // position. WorldEdit places nothing here either; saying "never true" would be a lie.
    const result = shapeVoxels('1', 8, true)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('surrounded')
  })
})

describe('the evaluated volume is capped', () => {
  test('the cap is a clamp rather than a rejection', () => {
    expect(clampSize(1000)).toBe(MAX_SIZE)
    expect(clampSize(0)).toBe(1)
    expect(clampSize(Number.NaN)).toBeGreaterThan(0)
  })

  test('a size past the cap draws the capped volume rather than freezing', () => {
    const field = filledOf('x^2+y^2+z^2 < 1', 1000, false)
    expect(field.size).toBe(MAX_SIZE)
  })
})
