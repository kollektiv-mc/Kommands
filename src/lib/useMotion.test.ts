import { expect, test } from 'vitest'
import { sequence, track } from './useMotion'

/** The two calls `sequence` makes on an effect, recording the delay it is given. */
function effect(duration: number) {
  const timing = { duration, delay: 0 }
  const fake = {
    getTiming: () => timing,
    updateTiming: (next: { delay: number }) => void (timing.delay = next.delay),
  }
  return { timing, effect: fake as unknown as KeyframeEffect }
}

test('leaving fades first, staying slides with the resize, new last', () => {
  const out = effect(150)
  const stay = effect(280)
  const arrive = effect(150)
  track('remove', out.effect)
  track('remain', stay.effect)
  track('add', arrive.effect)

  // The resize waits for what leaves, and answers how long that is.
  expect(sequence(280)).toBe(150)
  expect(out.timing.delay).toBe(0)
  expect(stay.timing.delay).toBe(150)
  // A new tile is never drawn before the sheet has the room for it.
  expect(arrive.timing.delay).toBe(150 + 280)
})

test('with nothing leaving, nothing waits for it', () => {
  const stay = effect(280)
  const arrive = effect(150)
  track('remain', stay.effect)
  track('add', arrive.effect)

  expect(sequence(280)).toBe(0)
  expect(stay.timing.delay).toBe(0)
  expect(arrive.timing.delay).toBe(280)
  // One change is ordered once: the next resize has nothing of this one to move.
  expect(sequence(280)).toBe(0)
  expect(arrive.timing.delay).toBe(280)
})
