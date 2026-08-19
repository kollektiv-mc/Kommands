import { describe, expect, test } from 'vitest'
import { writeSnbt, type SnbtValue } from './snbt'

describe('writeSnbt', () => {
  test('a compound writes bare keys and no spaces', () => {
    // Minecraft accepts whitespace; the canonical fixtures have none, and a generator
    // whose output differs from the documented form by invisible characters is a
    // generator whose fixtures cannot be compared byte-for-byte.
    const value: SnbtValue = {
      kind: 'compound',
      entries: [
        ['amount', { kind: 'number', value: 4 }],
        ['slot', { kind: 'string', value: 'chest' }],
      ],
    }
    expect(writeSnbt(value)).toBe('{amount:4,slot:"chest"}')
  })

  test('entry order is the order given, not alphabetical', () => {
    // The property the ordered-array shape exists for. An attribute modifier is
    // written type, amount, operation, slot, id — sorting it would emit a different
    // string for the same value.
    const value: SnbtValue = {
      kind: 'compound',
      entries: [
        ['type', { kind: 'string', value: 'z' }],
        ['amount', { kind: 'number', value: 1 }],
      ],
    }
    expect(writeSnbt(value)).toBe('{type:"z",amount:1}')
  })

  test('a key needing quotes gets them', () => {
    const value: SnbtValue = {
      kind: 'compound',
      entries: [['a key', { kind: 'bool', value: true }]],
    }
    expect(writeSnbt(value)).toBe('{"a key":true}')
  })

  test('quotes and backslashes inside a string are escaped', () => {
    expect(writeSnbt({ kind: 'string', value: 'a "b" \\ c' })).toBe('"a \\"b\\" \\\\ c"')
  })

  test('a numeric suffix is appended when a spec asks for one', () => {
    expect(writeSnbt({ kind: 'number', value: 4, suffix: 'f' })).toBe('4f')
    expect(writeSnbt({ kind: 'number', value: 4 })).toBe('4')
  })

  test('raw is inserted verbatim, so a quoted JSON string survives intact', () => {
    // The reason `raw` exists. A pre-1.21.5 text component *is* a quoted JSON string;
    // encoding it as an SNBT string would escape the quotes it is made of.
    const value: SnbtValue = {
      kind: 'compound',
      entries: [['custom_name', { kind: 'raw', text: `'{"text":"Digger"}'` }]],
    }
    expect(writeSnbt(value)).toBe(`{custom_name:'{"text":"Digger"}'}`)
  })

  test('lists nest', () => {
    const value: SnbtValue = {
      kind: 'list',
      items: [
        { kind: 'compound', entries: [['id', { kind: 'string', value: 'a' }]] },
        { kind: 'compound', entries: [['id', { kind: 'string', value: 'b' }]] },
      ],
    }
    expect(writeSnbt(value)).toBe('[{id:"a"},{id:"b"}]')
  })

  test('empty compounds and lists are still written', () => {
    expect(writeSnbt({ kind: 'compound', entries: [] })).toBe('{}')
    expect(writeSnbt({ kind: 'list', items: [] })).toBe('[]')
  })
})
