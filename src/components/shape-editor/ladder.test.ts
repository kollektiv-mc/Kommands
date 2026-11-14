import { describe, expect, test } from 'vitest'
import { moveLadder, RUNG_HEIGHT, rungOf, startLadder } from './ladder'

describe('the value ladder', () => {
  test('starts on the rung of the field step', () => {
    expect(rungOf(1)).toBe(2)
    expect(rungOf(0.05)).toBe(4)
    expect(rungOf(0.0001)).toBe(5)
    expect(rungOf(500)).toBe(0)
  })

  test('sideways moves by the rung step', () => {
    const l = startLadder(2, 0.1, 100, 100)
    expect(moveLadder(l, 136, 100).value).toBe(2.3)
    expect(moveLadder(l, 76, 100).value).toBe(1.8)
  })

  test('down a row takes the finer step, up the coarser', () => {
    const l = startLadder(2, 1, 100, 100)
    expect(moveLadder(l, 100, 100 + RUNG_HEIGHT).rung).toBe(3)
    expect(moveLadder(l, 100, 100 - RUNG_HEIGHT * 9).rung).toBe(0)
  })

  test('a new rung counts from the value then', () => {
    let l = startLadder(0, 1, 0, 0)
    l = moveLadder(l, 24, 0)
    expect(l.value).toBe(2)
    l = moveLadder(l, 24, RUNG_HEIGHT)
    expect(l.value).toBe(2)
    l = moveLadder(l, 36, RUNG_HEIGHT)
    expect(l.value).toBe(2.1)
  })
})
