import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { makeRegistryLookup } from '../../data/versions/registry'
import type { SerializeContext } from '../../data/versions/types'
import {
  isKnownBlock,
  parsePattern,
  serializePattern,
  validatePattern,
  DEFAULT_STATE,
  RANDOM_STATE,
  withProperty,
  type PatternEntry,
  type PatternValue,
} from './we-pattern'
import { expressionSource, validateExpression } from './we-expression'

const ctx: SerializeContext = {
  traits: v1_21_1.traits,
  registries: makeRegistryLookup(
    { block: ['stone', 'dirt', 'oak_log'], 'tag/block': ['logs'] },
    { oak_log: [{ axis: ['x', 'y', 'z'] }, { axis: 'y' }] },
  ),
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

describe('the expression field reports what is actually wrong', () => {
  // The grammar itself is tested in src/worldedit/expression — these are about the
  // argument type being wired to it. Before it existed this validator balanced brackets
  // and nothing else, so `2 +* 3` and `frobnicate(x)` both passed silently.

  test('a valid expression is silent', () => {
    expect(validateExpression('(x^2+y^2+z^2) < 1')).toEqual([])
    expect(validateExpression('y < sin(x*8)*0.2')).toEqual([])
  })

  test('an unbalanced bracket is still caught, as it always was', () => {
    expect(validateExpression('sin(x*8')).toHaveLength(1)
    expect(validateExpression('x*8)')).toHaveLength(1)
  })

  test('and now so is a malformed expression that balances perfectly', () => {
    expect(validateExpression('2 +* 3')).toHaveLength(1)
  })

  test('an unknown function is named', () => {
    expect(validateExpression('frobnicate(x)')[0]?.message).toContain('frobnicate')
  })

  test('operators that look like brackets are not brackets', () => {
    expect(validateExpression('x < 1 && y > 2')).toEqual([])
  })

  test('an empty field says nothing, because it is unfinished rather than wrong', () => {
    expect(validateExpression('')).toEqual([])
  })

  test('every diagnostic is a warning — this field never blocks the command', () => {
    for (const source of ['sin(x*8', '2 +* 3', 'frobnicate(x)', 'perlin(x,y,z,1,1,1)']) {
      for (const diagnostic of validateExpression(source)) {
        expect(diagnostic.severity).toBe('warning')
      }
    }
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

describe('a pattern read back from its text', () => {
  test('weights and plain entries round trip', () => {
    const text = '50%stone,25.5%dirt,oak_log'
    expect(parsePattern(text).entries).toEqual([
      { block: 'stone', weight: 50 },
      { block: 'dirt', weight: 25.5 },
      { block: 'oak_log', weight: '' },
    ])
    expect(serializePattern(parsePattern(text))).toBe(text)
  })

  test('what it cannot split stays whole, as the field would', () => {
    expect(parsePattern(' #simplex , ').entries).toEqual([{ block: '#simplex', weight: '' }])
    expect(parsePattern('').entries).toEqual([])
  })
})

describe('the four kinds of entry', () => {
  const one = (entry: PatternEntry) => serializePattern({ entries: [entry] })

  test('a block writes the states it names', () => {
    expect(one({ block: 'oak_log', weight: '', states: { axis: 'x' } })).toBe('oak_log[axis=x]')
  })

  test('a random block is starred, its fixed states kept', () => {
    // RandomStatePatternParser: what the brackets leave out is random.
    expect(one({ block: 'oak_stairs', weight: '', random: true })).toBe('*oak_stairs')
    const half = { block: 'oak_stairs', weight: '' as const, random: true, states: { half: 'top' } }
    expect(one(half)).toBe('*oak_stairs[half=top]')
  })

  test('a tag is ##, and ##* with every state', () => {
    expect(one({ kind: 'tag', block: 'logs', weight: '' })).toBe('##logs')
    expect(one({ kind: 'tag', block: 'logs', weight: '', anyState: true })).toBe('##*logs')
  })

  test('change existing writes ^ with a type, states, or both', () => {
    expect(one({ kind: 'apply', block: 'stone', weight: '' })).toBe('^stone')
    const dry = { kind: 'apply' as const, block: '', weight: '' as const }
    expect(one({ ...dry, states: { waterlogged: 'false' } })).toBe('^[waterlogged=false]')
    expect(one(dry)).toBe('')
  })

  test('the clipboard writes its offset only when it has one', () => {
    expect(one({ kind: 'clipboard', block: '', weight: '' })).toBe('#clipboard')
    const moved = { kind: 'clipboard' as const, block: '', weight: '' as const }
    expect(one({ ...moved, offset: [1, 0, -2] })).toBe('#clipboard@[1,0,-2]')
  })

  test('weights go in front of every kind', () => {
    const value: PatternValue = {
      entries: [
        { kind: 'tag', block: 'logs', weight: 3 },
        { block: 'oak_log', weight: 1, states: { axis: 'x' } },
      ],
    }
    expect(serializePattern(value)).toBe('3%##logs,1%oak_log[axis=x]')
  })

  test('every kind reads back as it was written', () => {
    const text = '3%##*logs,*oak_stairs[half=top,facing=east],^[open=true],#clipboard@[0,1,0],dirt'
    expect(serializePattern(parsePattern(text))).toBe(text)
  })

  test('commas inside brackets do not split an entry', () => {
    expect(parsePattern('oak_log[axis=x,foo=bar],dirt').entries).toHaveLength(2)
  })

  test('an unknown tag, state or value warns', () => {
    const messages = (entry: PatternEntry) =>
      validatePattern({ entries: [entry] }, ctx).map((d) => d.message)
    expect(messages({ kind: 'tag', block: 'lgos', weight: '' })[0]).toContain('lgos')
    expect(messages({ block: 'oak_log', weight: '', states: { axes: 'x' } })[0]).toContain('axes')
    expect(messages({ block: 'oak_log', weight: '', states: { axis: 'w' } })[0]).toContain('w')
    expect(messages({ block: 'oak_log', weight: '', states: { axis: 'x' } })).toEqual([])
  })
})

describe('changing one property of a block entry', () => {
  const stairs = {
    properties: {
      facing: ['north', 'east'],
      half: ['top', 'bottom'],
      waterlogged: ['true', 'false'],
    },
    defaults: { facing: 'north', half: 'bottom', waterlogged: 'false' },
  }
  const entry: PatternEntry = { block: 'oak_stairs', weight: '' }
  const text = (e: PatternEntry) => serializePattern({ entries: [e] })

  test('a set value is written, and its default is not', () => {
    const east = withProperty(entry, stairs, 'facing', 'east')
    expect(text(east)).toBe('oak_stairs[facing=east]')
    expect(text(withProperty(east, stairs, 'facing', 'north'))).toBe('oak_stairs')
  })

  test('random writes the other properties out, so they stay put', () => {
    const random = withProperty(entry, stairs, 'facing', RANDOM_STATE)
    expect(text(random)).toBe('*oak_stairs[half=bottom,waterlogged=false]')
  })

  test('a default chosen while random is written out too', () => {
    const random = withProperty(entry, stairs, 'facing', RANDOM_STATE)
    const top = withProperty(random, stairs, 'half', 'top')
    expect(text(withProperty(top, stairs, 'half', DEFAULT_STATE))).toBe(
      '*oak_stairs[half=bottom,waterlogged=false]',
    )
  })

  test('fixing the last random property drops the star and defaults', () => {
    const random = withProperty(entry, stairs, 'facing', RANDOM_STATE)
    expect(text(withProperty(random, stairs, 'facing', 'east'))).toBe('oak_stairs[facing=east]')
  })
})

describe('an expression held with the layers it was drawn from', () => {
  test('its text is what is checked and written', () => {
    const drawn = { source: 'x^2+y^2+z^2<1', layers: { version: 1, layers: [] } }
    expect(expressionSource(drawn)).toBe('x^2+y^2+z^2<1')
    expect(validateExpression(drawn)).toEqual(validateExpression('x^2+y^2+z^2<1'))
  })

  test('anything else reads as no text at all', () => {
    expect(expressionSource({ layers: [] })).toBe('')
    expect(expressionSource(undefined)).toBe('')
  })
})
