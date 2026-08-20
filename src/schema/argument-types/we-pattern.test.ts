import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { makeRegistryLookup } from '../../data/versions/registry'
import type { SerializeContext } from '../../data/versions/types'
import { isKnownBlock, serializePattern, validatePattern, type PatternValue } from './we-pattern'
import { validateExpression } from './we-expression'

const ctx: SerializeContext = {
  traits: v1_21_1.traits,
  registries: makeRegistryLookup({ block: ['stone', 'dirt', 'oak_log'] }),
}

const pattern = (...entries: Array<[string, number | '']>): PatternValue => ({
  entries: entries.map(([block, weight]) => ({ block, weight })),
})

describe('serializing a WorldEdit pattern', () => {
  test('nothing chosen writes nothing, so the argument shows as a gap', () => {
    expect(serializePattern(pattern())).toBe('')
    expect(serializePattern(pattern(['', '']))).toBe('')
  })

  test('one block is written bare', () => {
    expect(serializePattern(pattern(['stone', '']))).toBe('stone')
  })

  test('a weight on a single block is dropped rather than written', () => {
    // Verified against WorldEdit's RandomPatternParser: a one-token pattern returns
    // null and falls through to the plain block parser, which does not understand
    // `50%`. Writing it would turn a working command into a parse error.
    expect(serializePattern(pattern(['stone', 50]))).toBe('stone')
  })

  test('several blocks are comma-separated with their weights in front', () => {
    expect(serializePattern(pattern(['stone', 50], ['dirt', 50]))).toBe('50%stone,50%dirt')
  })

  test('an unweighted entry alongside a weighted one stays bare', () => {
    // WorldEdit reads a bare entry as chance 1. Inventing a number here would change
    // the mix the user asked for.
    expect(serializePattern(pattern(['stone', 3], ['dirt', '']))).toBe('3%stone,dirt')
  })

  test('a fractional weight survives, because the grammar allows one', () => {
    expect(serializePattern(pattern(['stone', 2.5], ['dirt', 97.5]))).toBe('2.5%stone,97.5%dirt')
  })

  test('a half-typed row is left out rather than emitted empty', () => {
    expect(serializePattern(pattern(['stone', 50], ['', 50]))).toBe('stone')
  })

  test('whitespace around an id does not reach the command', () => {
    expect(serializePattern(pattern([' stone ', 50], ['dirt', 50]))).toBe('50%stone,50%dirt')
  })
})

describe('validating a WorldEdit pattern', () => {
  test('a block outside the version registry warns', () => {
    const [first] = validatePattern(pattern(['stnoe', ''], ['dirt', '']), ctx)
    expect(first?.severity).toBe('warning')
    expect(first?.message).toContain('stnoe')
  })

  test('a namespaced id is checked on its bare name, not rejected for the namespace', () => {
    expect(validatePattern(pattern(['minecraft:stone', ''], ['dirt', '']), ctx)).toEqual([])
  })

  test('a lone weighted entry says why the weight is going to be dropped', () => {
    const messages = validatePattern(pattern(['stone', 50]), ctx).map((d) => d.message)
    expect(messages.some((m) => m.includes('single-block'))).toBe(true)
  })

  test('a weight of zero warns, because it never places its block', () => {
    const messages = validatePattern(pattern(['stone', 0], ['dirt', 1]), ctx).map((d) => d.message)
    expect(messages.some((m) => m.includes('never places'))).toBe(true)
  })

  test('a valid weighted pattern is silent', () => {
    expect(validatePattern(pattern(['stone', 50], ['dirt', 50]), ctx)).toEqual([])
  })
})

describe('validating a WorldEdit expression', () => {
  test('a balanced expression is silent', () => {
    expect(validateExpression('(x^2+y^2+z^2) < 1')).toEqual([])
    expect(validateExpression('y < sin(x*8)*0.2')).toEqual([])
  })

  test('an unclosed bracket warns', () => {
    expect(validateExpression('sin(x*8')[0]?.message).toContain('unclosed')
  })

  test('closing something never opened warns', () => {
    expect(validateExpression('x*8)')[0]?.message).toContain('never opened')
  })

  test('mismatched kinds are caught rather than counted', () => {
    // A naive counter passes this: one opener, one closer. They are not a pair.
    expect(validateExpression('(x]')).toHaveLength(1)
  })

  test('operators that look like brackets are not brackets', () => {
    expect(validateExpression('x < 1 && y > 2')).toEqual([])
  })
})

describe('the editor and the validator ask the same question', () => {
  // They did not. The field marked `minecraft:stone` invalid — it asked the registry
  // for the namespaced id, which registries do not hold — while validatePattern beside
  // it stripped the namespace and said nothing. A red field with no warning is worse
  // than either alone: the user cannot tell what is wrong because nothing is.
  test('a namespaced id is known to both', () => {
    expect(isKnownBlock('minecraft:stone', ctx)).toBe(true)
    expect(validatePattern(pattern(['minecraft:stone', ''], ['dirt', '']), ctx)).toEqual([])
  })

  test('whitespace does not make a real block unknown', () => {
    expect(isKnownBlock('  stone  ', ctx)).toBe(true)
  })

  test('an empty field is not marked wrong — it is unfinished, not invalid', () => {
    expect(isKnownBlock('', ctx)).toBe(true)
  })

  test('a genuine typo is unknown to both', () => {
    expect(isKnownBlock('stnoe', ctx)).toBe(false)
    expect(validatePattern(pattern(['stnoe', ''], ['dirt', '']), ctx)).toHaveLength(1)
  })
})
