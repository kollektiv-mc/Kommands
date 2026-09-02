import { afterEach, expect, test } from 'vitest'
import { durationMs } from './motion'

afterEach(() => {
  document.documentElement.style.removeProperty('--test-duration')
})

test('a token in milliseconds reads as its number', () => {
  document.documentElement.style.setProperty('--test-duration', '280ms')
  expect(durationMs('--test-duration', 1)).toBe(280)
})

test('a token in seconds is converted rather than taken at face value', () => {
  // The trap this parser exists for. A reader that knew only `ms` would take `0.28s`
  // as 0.28 milliseconds and fire its timer in the same frame, which looks like the
  // motion simply not happening.
  document.documentElement.style.setProperty('--test-duration', '0.28s')
  expect(durationMs('--test-duration', 1)).toBe(280)
})

test('an absent or unparseable token falls back rather than answering NaN', () => {
  // Not defensive padding: no stylesheet is loaded under jsdom, so this is the branch
  // every test in this repo actually takes. A NaN here turns a timer into an immediate
  // fire, which is worse than the wrong duration.
  expect(durationMs('--nothing-defines-this', 280)).toBe(280)
  document.documentElement.style.setProperty('--test-duration', 'fast')
  expect(durationMs('--test-duration', 280)).toBe(280)
})
