import { describe, expect, test } from 'vitest'
import {
  COORDINATE_SHAPES,
  coordinateProblems,
  relativeHere,
  serializeCoordinates,
  splitCoordinates,
} from './coordinates'

const BLOCK = COORDINATE_SHAPES.block_pos!
const VEC3 = COORDINATE_SHAPES.vec3!
const COLUMN = COORDINATE_SHAPES.column_pos!
const ROTATION = COORDINATE_SHAPES.rotation!

describe('stored shape', () => {
  test('an empty part keeps its place', () => {
    expect(splitCoordinates('1  ', 3)).toEqual(['1', '', ''])
    expect(splitCoordinates(' 2 ', 3)).toEqual(['', '2', ''])
  })

  test('a value typed into the old text field loads as its parts', () => {
    // Saved before these arguments had fields: one string, spaced however it was typed.
    expect(splitCoordinates('~  ~1   ~', 3)).toEqual(['~', '~1', '~'])
    expect(splitCoordinates('', 3)).toEqual(['', '', ''])
  })

  test('a value emits every part or nothing, so a later argument never slides left', () => {
    expect(serializeCoordinates('1 64 -3', BLOCK)).toBe('1 64 -3')
    expect(serializeCoordinates('1  ', BLOCK)).toBe('')
    expect(serializeCoordinates(relativeHere(BLOCK), BLOCK)).toBe('~ ~ ~')
    expect(serializeCoordinates(relativeHere(COLUMN), COLUMN)).toBe('~ ~')
  })
})

describe('grammar, per minecraft.wiki Argument types', () => {
  test.each([
    [BLOCK, '0 0 0'],
    [BLOCK, '~ ~ ~'],
    [BLOCK, '^ ^ ^'],
    [BLOCK, '^1 ^ ^-5'],
    [BLOCK, '~0.5 ~1 ~-5'],
    [VEC3, '0.1 -0.5 .9'],
    [COLUMN, '~1 ~-2'],
    [ROTATION, '~-5 ~5'],
  ])('%# accepts the wiki example %s', (shape, value) => {
    expect(coordinateProblems(value, shape)).toEqual([])
  })

  test('a block position is whole numbers, though an offset need not be', () => {
    expect(coordinateProblems('0.5 0 0', BLOCK)).toEqual(['x must be a whole number'])
    expect(coordinateProblems('0.5 0 0', VEC3)).toEqual([])
  })

  test('local coordinates come all together, and only where the parser takes them', () => {
    expect(coordinateProblems('^ ~ ^', BLOCK)).toEqual([
      'Local (^) coordinates cannot be mixed with others',
    ])
    expect(coordinateProblems('^ ^', COLUMN)).toEqual([
      'x cannot be local (^) here',
      'z cannot be local (^) here',
    ])
  })

  test('a half-filled position says which parts it still needs', () => {
    expect(coordinateProblems('1  ', BLOCK)).toEqual(['Needs y and z too'])
    expect(coordinateProblems('a 0 0', BLOCK)).toEqual(['x must be a number, ~ or ^'])
    expect(coordinateProblems('~a 0 0', BLOCK)).toEqual(['x: an offset after ~ is a number'])
  })
})
