import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../data/versions/1.21.1'
import { makeRegistryLookup } from '../data/versions/registry'
import type { SerializeContext, VersionTraits } from '../data/versions/types'
import { writeSnbt } from './snbt'
import {
  emptyTextComponent,
  isEmptyTextComponent,
  serializeTextComponent,
  textComponentField,
  validateTextComponent,
  type TextComponent,
} from './text-component'

/**
 * The text-component grammar, in both of the forms 1.21.1 and 1.21.5 write.
 *
 * Shapes verified against SpyglassMC/vanilla-mcdoc (`java/util/text.mcdoc`, whose
 * `#[since]` / `#[until]` guards are explicit) and cross-checked against Kyori
 * Adventure's `JSONOptions`, which gates emission per Minecraft version — see
 * docs/minecraft-versions.md § Provenance. The wiki page for the pre-1.21.5 form is
 * the usual reference and was unreachable from this environment; these two are
 * primary sources rather than a substitute for one.
 *
 * Both renderings are asserted for every shape on purpose. They are built from one
 * traversal, and the bug that arrangement exists to prevent — a field reaching the
 * JSON form and not the SNBT one — is invisible to a test that checks only one.
 */

const registries = makeRegistryLookup({
  item: ['stone'],
  entity_type: ['pig'],
})

const ctxFor = (traits: VersionTraits): SerializeContext => ({ traits, registries })
const ctx = ctxFor(v1_21_1.traits)
/** One flag, and the 1.21.5 form comes out. Nothing here names a version. */
const modern = ctxFor({ ...v1_21_1.traits, textComponentFormat: 'snbt' })

const plain = (text: string, rest: Partial<TextComponent> = {}): TextComponent => ({
  content: { kind: 'text', text },
  ...rest,
})

/** The field form, rendered — `textComponentField` returns a node, not a string. */
const field = (value: TextComponent, c: SerializeContext) => writeSnbt(textComponentField(value, c))

describe('content kinds', () => {
  test('text', () => {
    expect(serializeTextComponent(plain('hi'), ctx)).toBe('{"text":"hi"}')
    expect(serializeTextComponent(plain('hi'), modern)).toBe('{text:"hi"}')
  })

  test('translate, with arguments and a fallback', () => {
    const value: TextComponent = {
      content: {
        kind: 'translate',
        translate: 'chat.type.text',
        fallback: '%s says %s',
        with: [plain('Steve'), plain('hi')],
      },
    }
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"translate":"chat.type.text","fallback":"%s says %s","with":[{"text":"Steve"},{"text":"hi"}]}',
    )
    expect(serializeTextComponent(value, modern)).toBe(
      '{translate:"chat.type.text",fallback:"%s says %s",with:[{text:"Steve"},{text:"hi"}]}',
    )
  })

  test('selector, with a separator', () => {
    const value: TextComponent = {
      content: { kind: 'selector', selector: '@a', separator: plain(', ', { color: 'gray' }) },
    }
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"selector":"@a","separator":{"text":", ","color":"gray"}}',
    )
  })

  test('score writes a nested object, in both forms', () => {
    // The shape the old two-walk arrangement dropped from SNBT while keeping it in
    // JSON: the SNBT walk handled strings, booleans and `extra`, and silently skipped
    // anything else. A score is the first field that is none of those.
    const value: TextComponent = { content: { kind: 'score', objective: 'kills', name: '@s' } }
    expect(serializeTextComponent(value, ctx)).toBe('{"score":{"objective":"kills","name":"@s"}}')
    expect(serializeTextComponent(value, modern)).toBe('{score:{objective:"kills",name:"@s"}}')
  })
})

describe('nesting', () => {
  test('extra children are components in their own right', () => {
    const value = plain('one', { extra: [plain('two', { bold: true }), plain('three')] })
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"text":"one","extra":[{"text":"two","bold":true},{"text":"three"}]}',
    )
    expect(serializeTextComponent(value, modern)).toBe(
      '{text:"one",extra:[{text:"two",bold:true},{text:"three"}]}',
    )
  })

  test('an empty child is left out, and an all-empty list takes the key with it', () => {
    // mcdoc types `extra` as `[Text] @ 1..`, so an empty list is not a smaller value —
    // it is an invalid one.
    expect(serializeTextComponent(plain('one', { extra: [plain('')] }), ctx)).toBe('{"text":"one"}')
    expect(serializeTextComponent(plain('one', { extra: [plain(''), plain('two')] }), ctx)).toBe(
      '{"text":"one","extra":[{"text":"two"}]}',
    )
  })

  test('children nest arbitrarily deep', () => {
    const value = plain('a', { extra: [plain('b', { extra: [plain('c')] })] })
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"text":"a","extra":[{"text":"b","extra":[{"text":"c"}]}]}',
    )
  })
})

describe('click events', () => {
  test('1.21.1 writes clickEvent, and every action pays out under value', () => {
    const value = plain('Click', { clickEvent: { action: 'run_command', value: '/say hi' } })
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"text":"Click","clickEvent":{"action":"run_command","value":"/say hi"}}',
    )
  })

  test('1.21.5 renames the wrapper and gives each action its own payload key', () => {
    const value = plain('Click', { clickEvent: { action: 'run_command', value: '/say hi' } })
    expect(serializeTextComponent(value, modern)).toBe(
      '{text:"Click",click_event:{action:"run_command",command:"/say hi"}}',
    )
    expect(
      serializeTextComponent(
        plain('Go', { clickEvent: { action: 'open_url', value: 'x' } }),
        modern,
      ),
    ).toBe('{text:"Go",click_event:{action:"open_url",url:"x"}}')
  })

  test('a page stays a quoted string in both forms', () => {
    // mcdoc moves change_page to an int at 1.21.5 and Kyori Adventure moves it at
    // 1.21.6. Nothing here can settle that, and at the version this project targets it
    // is a string either way — so the verified shape is the one asserted.
    const value = plain('Next', { clickEvent: { action: 'change_page', value: '2' } })
    expect(serializeTextComponent(value, ctx)).toContain('"value":"2"')
    expect(serializeTextComponent(value, modern)).toContain('page:"2"')
  })
})

describe('hover events', () => {
  test('show_text pays out under contents at 1.21.1 and under value at 1.21.5', () => {
    // The nastiest rename in the grammar, because the two keys swap rather than move
    // in one direction: `contents` is the modern-looking name and it is the *old* one.
    const value = plain('Hover', {
      hoverEvent: { action: 'show_text', contents: plain('Tip', { italic: true }) },
    })
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"text":"Hover","hoverEvent":{"action":"show_text","contents":{"text":"Tip","italic":true}}}',
    )
    expect(serializeTextComponent(value, modern)).toBe(
      '{text:"Hover",hover_event:{action:"show_text",value:{text:"Tip",italic:true}}}',
    )
  })

  test('show_item nests under contents at 1.21.1 and spreads flat at 1.21.5', () => {
    const value = plain('Item', { hoverEvent: { action: 'show_item', id: 'stone', count: 3 } })
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"text":"Item","hoverEvent":{"action":"show_item","contents":{"id":"minecraft:stone","count":3}}}',
    )
    expect(serializeTextComponent(value, modern)).toBe(
      '{text:"Item",hover_event:{action:"show_item",id:"minecraft:stone",count:3}}',
    )
  })

  test('show_entity swaps its two id keys at 1.21.5', () => {
    // type -> id and id -> uuid, at the same time. Crossing them produces a component
    // that parses and shows the wrong thing, and nothing warns.
    const value = plain('Who', {
      hoverEvent: { action: 'show_entity', entityType: 'pig', id: 'abc-123' },
    })
    expect(serializeTextComponent(value, ctx)).toBe(
      '{"text":"Who","hoverEvent":{"action":"show_entity","contents":{"type":"minecraft:pig","id":"abc-123"}}}',
    )
    expect(serializeTextComponent(value, modern)).toBe(
      '{text:"Who",hover_event:{action:"show_entity",id:"minecraft:pig",uuid:"abc-123"}}',
    )
  })
})

describe('the argument form and the field form stay different things', () => {
  test('a component with events survives being quoted into a data component', () => {
    const value = plain('Name', { clickEvent: { action: 'copy_to_clipboard', value: "it's" } })
    // The field form is a string containing the JSON, so the apostrophe inside it has
    // to be escaped for the single quotes wrapping it — on top of JSON's own escaping.
    expect(field(value, ctx)).toBe(
      '\'{"text":"Name","clickEvent":{"action":"copy_to_clipboard","value":"it\\\'s"}}\'',
    )
  })

  test('from 1.21.5 the field holds the component itself, unquoted', () => {
    expect(field(plain('Name'), modern)).toBe('{text:"Name"}')
  })
})

describe('emptiness is a property of the content', () => {
  test('each kind knows what empty means for it', () => {
    expect(isEmptyTextComponent(emptyTextComponent())).toBe(true)
    expect(isEmptyTextComponent(plain('hi'))).toBe(false)
    expect(isEmptyTextComponent({ content: { kind: 'translate', translate: '' } })).toBe(true)
    expect(isEmptyTextComponent({ content: { kind: 'translate', translate: 'a.b' } })).toBe(false)
    expect(isEmptyTextComponent({ content: { kind: 'selector', selector: '@a' } })).toBe(false)
    // Half a score is empty, not half-full: the game wants both halves.
    expect(isEmptyTextComponent({ content: { kind: 'score', objective: 'k', name: '' } })).toBe(
      true,
    )
    expect(isEmptyTextComponent({ content: { kind: 'score', objective: 'k', name: '@s' } })).toBe(
      false,
    )
  })

  test('a component with only a colour is still empty', () => {
    // Otherwise picking a colour and typing nothing puts `{"color":"red"}` in the
    // command — valid syntax that renders nothing.
    expect(isEmptyTextComponent(plain('', { color: 'red' }))).toBe(true)
  })
})

describe('validation warns, and never blocks', () => {
  const messages = (value: TextComponent) =>
    validateTextComponent(value, {}, ctx).map((d) => d.message)

  test('half a score is reported', () => {
    expect(messages({ content: { kind: 'score', objective: '', name: '@s' } })).toEqual([
      'A score needs an objective.',
    ])
  })

  test('a run_command without its leading slash is reported', () => {
    // mcdoc marks it `#[command(slash="required")]` at this version, while
    // suggest_command is `slash="chat"` and needs none.
    expect(
      messages(plain('x', { clickEvent: { action: 'run_command', value: 'say hi' } })),
    ).toEqual(['A run_command click needs a leading slash.'])
    expect(
      messages(plain('x', { clickEvent: { action: 'suggest_command', value: 'say hi' } })),
    ).toEqual([])
  })

  test('a page that is not a whole number is reported', () => {
    expect(messages(plain('x', { clickEvent: { action: 'change_page', value: '0' } }))).toEqual([
      'A page must be a whole number, 1 or more.',
    ])
  })

  test('a colour that is neither a name nor a triplet is reported', () => {
    expect(messages(plain('x', { color: 'burgundy' }))).toEqual([
      'burgundy is not a colour name, and not a six-digit hex triplet.',
    ])
    expect(messages(plain('x', { color: 'red' }))).toEqual([])
  })

  test('hover payloads are checked against the version registry', () => {
    expect(
      messages(plain('x', { hoverEvent: { action: 'show_item', id: 'copper_sword' } })),
    ).toEqual(['copper_sword is not an item in this version.'])
    expect(
      messages(plain('x', { hoverEvent: { action: 'show_entity', entityType: 'dino', id: 'u' } })),
    ).toEqual(['dino is not an entity type in this version.'])
  })

  test('warnings from nested components reach the top', () => {
    const nested = plain('x', { extra: [plain('y', { color: 'burgundy' })] })
    expect(messages(nested)).toEqual([
      'burgundy is not a colour name, and not a six-digit hex triplet.',
    ])
  })
})
