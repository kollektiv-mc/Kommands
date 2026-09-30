import { describe, expect, test } from 'vitest'
import { filterOptions, stepIndex, typeaheadIndex, type ListOption } from './listbox'

const options: ListOption[] = [
  { value: 'minecraft:stone', label: 'minecraft:stone' },
  { value: 'minecraft:netherite_sword', label: 'minecraft:netherite_sword' },
  { value: 'sharpness', label: 'Sharpness' },
  { value: 'smite', label: 'Smite' },
]

describe('filterOptions', () => {
  test('matches anywhere in the label or value, ignoring case', () => {
    expect(filterOptions(options, 'SWORD').map((o) => o.value)).toEqual([
      'minecraft:netherite_sword',
    ])
  })

  test('an empty query keeps everything, as a copy', () => {
    const all = filterOptions(options, '  ')
    expect(all).toEqual(options)
    expect(all).not.toBe(options)
  })
})

describe('typeaheadIndex', () => {
  test('finds the next label starting with the buffer, wrapping', () => {
    expect(typeaheadIndex(options, 's', 0)).toBe(2)
    expect(typeaheadIndex(options, 's', 3)).toBe(3)
    expect(typeaheadIndex(options, 'sm', 0)).toBe(3)
  })

  test('answers -1 for no match or no buffer', () => {
    expect(typeaheadIndex(options, 'x')).toBe(-1)
    expect(typeaheadIndex(options, ' ')).toBe(-1)
    expect(typeaheadIndex([], 's')).toBe(-1)
  })
})

describe('stepIndex', () => {
  test('wraps at both ends', () => {
    expect(stepIndex(3, 1, 4)).toBe(0)
    expect(stepIndex(0, -1, 4)).toBe(3)
  })

  test('enters from nothing at the end it is moving toward', () => {
    expect(stepIndex(-1, 1, 4)).toBe(0)
    expect(stepIndex(-1, -1, 4)).toBe(3)
  })

  test('has nowhere to go in an empty list', () => {
    expect(stepIndex(0, 1, 0)).toBe(-1)
  })
})
