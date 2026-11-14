import { Color } from 'three'
import { describe, expect, test } from 'vitest'
import { BLOCK_COLOURS } from '../../../data/authored/block-colours'
import { blockColour, blockPalette, cutAway, cutFacing, faceArrays, faceOutlines } from './faces'

const filledAll = (size: number) => new Uint8Array(size ** 3).fill(1)

describe('the pattern as colours', () => {
  test('weights are relative and an unweighted entry is 1', () => {
    const palette = blockPalette('3%stone,minecraft:dirt,1%oak_log[axis=x]')
    expect(palette.map((s) => [s.block, s.weight])).toEqual([
      ['stone', 3],
      ['dirt', 1],
      ['oak_log', 1],
    ])
  })

  test('an empty pattern draws stone', () => {
    expect(blockPalette(' ').map((s) => s.block)).toEqual(['stone'])
  })

  test('a listed block takes its colour from the table', () => {
    expect(blockColour('sandstone').equals(new Color(BLOCK_COLOURS['sandstone']))).toBe(true)
  })

  test('an unlisted block always gets the same colour', () => {
    expect(blockColour('pink_wool').equals(blockColour('pink_wool'))).toBe(true)
    expect(blockColour('pink_wool').equals(blockColour('lime_wool'))).toBe(false)
  })
})

describe('the exposed faces', () => {
  test('a lone block is six faces', () => {
    expect(faceArrays(new Uint8Array([1]), 1, blockPalette('stone'))?.quads).toBe(6)
  })

  test('a solid cube draws only its outside', () => {
    expect(faceArrays(filledAll(3), 3, blockPalette('stone'))?.quads).toBe(6 * 9)
  })

  test('nothing filled is nothing to draw', () => {
    expect(faceArrays(new Uint8Array(8), 2, blockPalette('stone'))).toBeNull()
  })

  test('the shares come out near the pattern chances', () => {
    const size = 16
    const palette = blockPalette('3%stone,1%dirt')
    const arrays = faceArrays(filledAll(size), size, palette)!
    const dirt = palette[1]!.colour
    let dirtFaces = 0
    for (let q = 0; q < arrays.quads; q++) {
      const [r, g, b] = arrays.color.subarray(q * 12, q * 12 + 3)
      const k = r! / dirt.r
      if (Math.abs(g! / dirt.g - k) < 1e-4 && Math.abs(b! / dirt.b - k) < 1e-4) dirtFaces++
    }
    expect(dirtFaces / arrays.quads).toBeGreaterThan(0.18)
    expect(dirtFaces / arrays.quads).toBeLessThan(0.32)
  })

  test('the outer faces sit half a block past the outer centres', () => {
    const arrays = faceArrays(filledAll(2), 2, blockPalette('stone'))!
    expect(Math.max(...arrays.position)).toBeCloseTo(2)
    expect(Math.min(...arrays.position)).toBeCloseTo(-2)
  })

  test('a wireframe is four edges per face', () => {
    const arrays = faceArrays(new Uint8Array([1]), 1, blockPalette('stone'))!
    expect(faceOutlines(arrays).position).toHaveLength(6 * 4 * 2 * 3)
  })
})

describe('cutaway', () => {
  test('hides the half nearer the camera', () => {
    expect(cutFacing({ x: 3, z: 1 })).toEqual({ axis: 'x', sign: 1 })
    expect(cutFacing({ x: 1, z: -4 })).toEqual({ axis: 'z', sign: -1 })
  })

  test('keeps the far half and the middle layer', () => {
    const shown = cutAway(filledAll(3), 3, { axis: 'x', sign: 1 })
    const xs = new Set<number>()
    shown.forEach((v, i) => v && xs.add(i % 3))
    expect([...xs].sort()).toEqual([0, 1])
  })
})
