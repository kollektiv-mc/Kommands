import { describe, expect, test } from 'vitest'
import { PARSERS, lookupParser, unimplementedDeepParsers } from './parsers'
import { hasArgumentType, lookupArgumentType, FALLBACK_TYPE } from '../../schema/argument-types'
import { NO_REGISTRIES } from '../versions/registry'

describe('the parser table', () => {
  test('covers every parser the pinned 1.21.1 tree uses', () => {
    // Measured against misode/mcmeta 1.21.1-summary. #4 replaces this count with a
    // check against the committed tree itself; until that exists, the number is the
    // guard against an entry being deleted by accident.
    expect(Object.keys(PARSERS)).toHaveLength(51)
  })

  test('every binding names a kind and a type', () => {
    for (const [parser, binding] of Object.entries(PARSERS)) {
      expect(binding.kind, parser).toMatch(/^(shallow|deep)$/)
      expect(binding.type, parser).toBeTruthy()
    }
  })

  test('a shallow parser without a bespoke editor still round-trips as text', () => {
    // `kind` is not "has an editor". A scalar is generically representable, so a
    // shallow type whose editor is not built yet gets a plainer editor, not a broken
    // one — the value survives unchanged. 34 of the 41 shallow types are in that
    // state today (block_pos, angle, gamemode …) and none of them lose data.
    const ctx = { traits: {}, registries: NO_REGISTRIES }
    for (const [parser, binding] of Object.entries(PARSERS)) {
      if (binding.kind !== 'shallow' || hasArgumentType(binding.type)) continue
      const type = lookupArgumentType(binding.type)
      expect(type.serialize('~10 ~ ~-3', ctx as never), parser).toBe('~10 ~ ~-3')
    }
  })

  test('deep parsers without an editor are a recorded gap, not a silent one', () => {
    // The asymmetry that matters. For a deep parser a text field *is* the missing
    // product — the user hand-writes what the app exists to build — so the gap is
    // enumerable rather than notional, and shrinks by itself as editors land.
    const gaps = unimplementedDeepParsers(hasArgumentType)
    // The list is computed, so it shrinks by itself as editors land. item_stack and
    // text_component left with #7; asserting their absence is what stops the list
    // from quietly going back to being a list nobody updates.
    expect(gaps.map((g) => g.type)).not.toContain('item_stack')
    expect(gaps.map((g) => g.type)).not.toContain('text_component')
    expect(gaps.map((g) => g.type)).toContain('nbt_path')
    expect(gaps.map((g) => g.type)).toContain('block_state')
    expect(hasArgumentType(FALLBACK_TYPE)).toBe(true)
  })
})

describe('lookupParser fails closed', () => {
  test('resolves a known parser', () => {
    expect(lookupParser('brigadier:integer')).toEqual({ kind: 'shallow', type: 'integer' })
  })

  test('throws on an unknown parser rather than silently binding raw_text', () => {
    // The guard that makes the policy real. A future Minecraft version adding a
    // parser must stop the build, not arrive as a text field nobody noticed. The
    // message names the parser — an error that does not say which one is barely
    // better than the silence it replaced.
    expect(() => lookupParser('minecraft:not_a_real_parser')).toThrowError(
      /unknown Brigadier parser: minecraft:not_a_real_parser/,
    )
  })

  test('an inherited Object property is not mistaken for a binding', () => {
    // PARSERS is an object literal, so it inherits Object.prototype: a truthiness
    // check accepted 'constructor' and returned the prototype member as if it were a
    // parser binding. Found by this test, fixed with Object.hasOwn.
    for (const inherited of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(() => lookupParser(inherited), inherited).toThrowError(/unknown Brigadier parser/)
    }
  })
})
