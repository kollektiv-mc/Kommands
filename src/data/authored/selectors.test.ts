import { describe, expect, test } from 'vitest'
import { selectorsFor } from './selectors'

const tokens = (options: { type?: string; amount?: string }) =>
  selectorsFor(options).map((s) => s.token)

describe('which shorthands an entity argument accepts', () => {
  test('a player-only argument accepts @s and refuses @e and @n', () => {
    // /give @s, /spawnpoint @s: Java Edition parses @s as a player-type selector and
    // fails only at run time when the executor is not a player.
    expect(tokens({ type: 'players' })).toEqual(['@p', '@r', '@s', '@a'])
  })

  test('a single-entity argument refuses the two that can match many', () => {
    expect(tokens({ amount: 'single' })).toEqual(['@p', '@r', '@s', '@n'])
  })

  test('an unconstrained argument accepts all six', () => {
    expect(tokens({})).toEqual(['@p', '@r', '@s', '@a', '@e', '@n'])
  })
})
