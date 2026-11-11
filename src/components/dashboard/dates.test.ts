import { expect, test } from 'vitest'
import { savedOn } from './dates'

test('a save date reads as day, short month and year', () => {
  expect(savedOn('2026-10-21T12:00:00.000Z')).toBe('21 Oct 2026')
  expect(savedOn('not a date')).toBe('')
})
