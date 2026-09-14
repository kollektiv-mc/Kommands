import { describe, expect, it } from 'vitest'
import { moveTo } from './reorder'

describe('moveTo', () => {
  it('moves an entry later, closing the gap behind it', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an entry earlier, pushing the rest along', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('swaps neighbours, which is what the keyboard controls ask for', () => {
    expect(moveTo(['a', 'b', 'c'], 1, 0)).toEqual(['b', 'a', 'c'])
    expect(moveTo(['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b'])
  })

  it('returns the list untouched when the move goes nowhere', () => {
    const items = ['a', 'b', 'c']
    // Referentially identical, not merely equal: a no-op reorder must not hand the
    // store a new array, or every dropped gesture would push an undo step.
    expect(moveTo(items, 1, 1)).toBe(items)
  })

  it('returns the list untouched for an out-of-range index', () => {
    const items = ['a', 'b', 'c']
    // Both ends, because both are reachable: the keyboard controls compute `from - 1`
    // and `from + 1` without checking, and a pointer can leave the list mid-drag.
    expect(moveTo(items, 0, -1)).toBe(items)
    expect(moveTo(items, 2, 3)).toBe(items)
    expect(moveTo(items, -1, 0)).toBe(items)
    expect(moveTo(items, 3, 0)).toBe(items)
  })

  it('leaves the input alone', () => {
    const items = ['a', 'b', 'c']
    moveTo(items, 0, 2)
    expect(items).toEqual(['a', 'b', 'c'])
  })

  it('handles a single-entry and an empty list', () => {
    expect(moveTo(['a'], 0, 0)).toEqual(['a'])
    expect(moveTo([], 0, 0)).toEqual([])
  })

  it('carries whatever it is given, since nothing about it is clause-specific', () => {
    expect(moveTo([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
  })
})
