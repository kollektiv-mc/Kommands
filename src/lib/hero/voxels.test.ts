import { expect, test, vi } from 'vitest'
import { cellCentre, drawBlocks, hexRgb, projector, shade, voxelise } from './voxels'

test('voxelise keeps the cells whose centres are inside', () => {
  const all = voxelise(() => true, 3)
  expect(all).toHaveLength(27)
  expect(all[0]).toEqual([-1, 0, -1])
  expect(voxelise(() => false, 3)).toHaveLength(0)
})

test('a hollow voxelisation drops the cells surrounded on all six sides', () => {
  expect(voxelise(() => true, 3, true)).toHaveLength(26)
})

test('cellCentre maps a cell back into the -1..1 selection', () => {
  expect(cellCentre([0, 1, 0], 3)).toEqual([0, 0, 0])
  const [x, y, z] = cellCentre([-1, 0, 1], 3)
  expect(x).toBeCloseTo(-2 / 3)
  expect(y).toBeCloseTo(-2 / 3)
  expect(z).toBeCloseTo(2 / 3)
})

test('projector puts the origin at the centre and y up the screen', () => {
  const p = projector({ yaw: 0, pitch: 0, s: 10, cx: 50, cy: 50 })
  expect(p(0, 0, 0)).toEqual([50, 50])
  expect(p(1, 0, 0)).toEqual([60, 50])
  expect(p(0, 1, 0)).toEqual([50, 40])
})

test('hexRgb reads six digits and refuses anything else', () => {
  expect(hexRgb('#ff8000')).toEqual([255, 128, 0])
  expect(() => hexRgb('ff8000')).toThrow()
  expect(() => hexRgb('#f80')).toThrow()
})

test('shade scales toward black and clamps', () => {
  expect(shade([200, 100, 50], 0.5)).toBe('rgb(100,50,25)')
  expect(shade([200, 100, 50], 2)).toBe('rgb(255,200,100)')
})

test('drawBlocks skips faces hidden by a solid neighbour', () => {
  const ctx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
  const view = { yaw: 0.6, pitch: 0.5, s: 10, cx: 0, cy: 0 }
  const g = ctx as unknown as CanvasRenderingContext2D
  drawBlocks(g, [{ p: [0, 0, 0], c: [100, 100, 100] }], view)
  const alone = ctx.fill.mock.calls.length
  expect(alone).toBe(3)
  ctx.fill.mockClear()
  drawBlocks(
    g,
    [
      { p: [0, 0, 0], c: [100, 100, 100] },
      { p: [0, 1, 0], c: [100, 100, 100] },
    ],
    view,
  )
  // The lower block's top is covered by the upper one.
  expect(ctx.fill.mock.calls.length).toBe(5)
  expect(ctx.globalAlpha).toBe(1)
})
