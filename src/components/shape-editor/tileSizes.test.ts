import { describe, expect, test } from 'vitest'
import { DEFAULT_SIZES, dragTiles, resetTiles, type Measured } from './tileSizes'

const from: Measured = { left: 240, right: 300, viewWidth: 800, viewHeight: 600, command: 66 }

describe('resizing the tiles', () => {
  test('the left gap widens the Shapes tile', () => {
    expect(dragTiles(DEFAULT_SIZES, 'left', from, 40, 0)).toEqual({ ...DEFAULT_SIZES, left: 280 })
  })

  test('the right gap widens the inspector leftwards', () => {
    expect(dragTiles(DEFAULT_SIZES, 'right', from, -40, 0).right).toBe(340)
  })

  test('a tile stops at its minimum and leaves the view room', () => {
    expect(dragTiles(DEFAULT_SIZES, 'left', from, -500, 0).left).toBe(180)
    expect(dragTiles(DEFAULT_SIZES, 'left', from, 900, 0).left).toBe(600)
  })

  test('the command box grows a whole line at a time', () => {
    expect(dragTiles(DEFAULT_SIZES, 'bottom', from, 0, -8).command).toBe(66)
    expect(dragTiles(DEFAULT_SIZES, 'bottom', from, 0, -12).command).toBe(84)
    expect(dragTiles(DEFAULT_SIZES, 'bottom', from, 0, 50).command).toBe(66)
  })

  test('a corner moves both of its gaps', () => {
    const next = dragTiles(DEFAULT_SIZES, 'right-bottom', from, -20, -36)
    expect(next).toEqual({ left: null, right: 320, command: 102 })
  })

  test('a double-click puts back only what the handle moves', () => {
    const sized = { left: 200, right: 300, command: 84 }
    expect(resetTiles(sized, 'left-bottom')).toEqual({ left: null, right: 300, command: null })
  })
})
