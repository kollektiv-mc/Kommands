import { expect, test } from 'vitest'
import { dotLevel, perlin } from './noise'

test('noise is zero on the lattice and the same on every call', () => {
  expect(perlin(3, 4, 5)).toBe(0)
  expect(perlin(1.3, 2.7, 0.4)).toBe(perlin(1.3, 2.7, 0.4))
})

test('noise moves smoothly between nearby points', () => {
  for (let i = 0; i < 50; i++) {
    const x = i * 0.37
    expect(Math.abs(perlin(x, 1.1, 2.2) - perlin(x + 0.001, 1.1, 2.2))).toBeLessThan(0.01)
  }
})

test('a dot level stays between 0 and 1 and changes over time', () => {
  const levels = Array.from({ length: 200 }, (_, i) => dotLevel(i % 20, i, i * 0.5))
  expect(Math.min(...levels)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...levels)).toBeLessThanOrEqual(1)
  expect(dotLevel(5, 5, 0)).not.toBe(dotLevel(5, 5, 3))
})
