import { describe, expect, test } from 'vitest'
import commandsPayload from '../../data/generated/1.21.1/commands.json'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { makeRegistryLookup } from '../../data/versions/registry'
import type { SerializeContext, VersionTraits } from '../../data/versions/types'
import type { AttributeModifier, EnchantmentsValue } from '../../data/authored/item-components'
import type { TextComponent } from '../text-component'
import { serializeCommand, type CommandValue } from '../serialize'
import type { CommandDefinition } from '../types'
import type { ItemStackValue } from './item-stack'

/**
 * The acceptance set for `/give`.
 *
 * These are the canonical outputs in docs/minecraft-versions.md § Canonical 1.21.1
 * output, asserted byte-for-byte and against the **derived** skeleton rather than a
 * hand-written one — so a deriver change that reshapes `/give` fails here too.
 *
 * If a serializer change breaks one of these, the change is wrong. They are not
 * examples; 1.21.1 sits between two breaking changes and each of these strings is the
 * one form that works in it.
 */

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
const GIVE = commands['vanilla:give']!

// The registries the validators and editors read. Only the entries these fixtures
// name are needed; `has` is what the validators call, and the ids below are real
// 1.21.1 ones taken from the committed registry.
const registries = makeRegistryLookup({
  item: ['netherite_sword', 'diamond_pickaxe', 'diamond_chestplate'],
  enchantment: ['sharpness', 'efficiency', 'unbreaking'],
  attribute: ['generic.armor'],
})

const ctxFor = (traits: VersionTraits): SerializeContext => ({ traits, registries })
const ctx = ctxFor(v1_21_1.traits)

// Paths, not names: '' is the root sequence, /2 its third child. See paths.ts.
const TARGETS = '/1'
const ITEM = '/2'
const COUNT = '/3'

const value = (args: Record<string, unknown>): CommandValue => ({
  args,
  flags: {},
  choices: {},
  repeats: {},
  refs: {},
})

const stack = (id: string, components: Record<string, unknown> = {}): ItemStackValue => ({
  id,
  components,
})

const enchantments = (levels: Record<string, number>): EnchantmentsValue => ({ levels })

describe('the three canonical /give fixtures', () => {
  test('enchantments carry the levels wrapper, and an optional count trails', () => {
    const out = serializeCommand(
      GIVE,
      value({
        [ITEM]: stack('netherite_sword', { enchantments: enchantments({ sharpness: 5 }) }),
        [COUNT]: 1,
      }),
      ctx,
    )
    expect(out).toBe('/give @p minecraft:netherite_sword[enchantments={levels:{sharpness:5}}] 1')
  })

  test('a custom name is a quoted JSON string, and components emit in sorted order', () => {
    const customName: TextComponent = { text: 'Digger', color: 'aqua' }
    const out = serializeCommand(
      GIVE,
      value({
        [ITEM]: stack('diamond_pickaxe', {
          // Added enchantments-first on purpose: the output must not depend on the
          // order the user reached for them.
          enchantments: enchantments({ unbreaking: 3, efficiency: 5 }),
          custom_name: customName,
        }),
      }),
      ctx,
    )
    expect(out).toBe(
      '/give @p minecraft:diamond_pickaxe[custom_name=\'{"text":"Digger","color":"aqua"}\',' +
        'enchantments={levels:{efficiency:5,unbreaking:3}}]',
    )
  })

  test('an attribute modifier keeps its declared field order and its version-spelled id', () => {
    // generic.armor, not armor. The prefix is required at 1.21.1 and forbidden from
    // 1.21.2, and it is read from the registry rather than computed — 1.21.1 uses
    // three different prefixes, so computing one emits an id that never existed.
    const modifier: AttributeModifier = {
      type: 'generic.armor',
      amount: 4,
      operation: 'add_value',
      slot: 'chest',
      id: 'kommands:bonus',
    }
    const out = serializeCommand(
      GIVE,
      value({ [ITEM]: stack('diamond_chestplate', { attribute_modifiers: [modifier] }) }),
      ctx,
    )
    expect(out).toBe(
      '/give @p minecraft:diamond_chestplate[attribute_modifiers={modifiers:[' +
        '{type:"minecraft:generic.armor",amount:4,operation:"add_value",slot:"chest",' +
        'id:"kommands:bonus"}]}]',
    )
  })
})

describe('the same values under different traits', () => {
  test('enchantmentsShape flat drops the levels wrapper', () => {
    // Nothing here names a version. One flag changes and the 1.21.5 form comes out,
    // which is the whole claim the trait model makes — tested before 1.21.5 exists.
    const future = ctxFor({ ...v1_21_1.traits, enchantmentsShape: 'flat' })
    const out = serializeCommand(
      GIVE,
      value({ [ITEM]: stack('netherite_sword', { enchantments: enchantments({ sharpness: 5 }) }) }),
      future,
    )
    expect(out).toBe('/give @p minecraft:netherite_sword[enchantments={sharpness:5}]')
  })

  test('show_in_tooltip rides the same trait as the wrapper it sits beside', () => {
    const withTooltip: EnchantmentsValue = { levels: { sharpness: 5 }, showInTooltip: false }
    expect(
      serializeCommand(
        GIVE,
        value({ [ITEM]: stack('netherite_sword', { enchantments: withTooltip }) }),
        ctx,
      ),
    ).toBe(
      '/give @p minecraft:netherite_sword[enchantments={levels:{sharpness:5},show_in_tooltip:false}]',
    )

    const future = ctxFor({ ...v1_21_1.traits, enchantmentsShape: 'flat' })
    expect(
      serializeCommand(
        GIVE,
        value({ [ITEM]: stack('netherite_sword', { enchantments: withTooltip }) }),
        future,
      ),
    ).toBe('/give @p minecraft:netherite_sword[enchantments={sharpness:5}]')
  })

  test('textComponentFormat snbt unquotes the component, inside the item and in a list', () => {
    const future = ctxFor({ ...v1_21_1.traits, textComponentFormat: 'snbt' })
    const out = serializeCommand(
      GIVE,
      value({
        [ITEM]: stack('diamond_pickaxe', {
          custom_name: { text: 'Digger', color: 'aqua' } satisfies TextComponent,
          lore: [{ text: 'one' }, { text: 'two' }] satisfies TextComponent[],
        }),
      }),
      future,
    )
    expect(out).toBe(
      '/give @p minecraft:diamond_pickaxe[custom_name={text:"Digger",color:"aqua"},' +
        'lore=[{text:"one"},{text:"two"}]]',
    )
  })

  test('lore is a list of quoted JSON strings at 1.21.1', () => {
    // Verified against SpyglassMC/vanilla-mcdoc: dispatch …[lore] is a list whose
    // element is `#[until="1.21.5"] #[text_component] string`. See
    // docs/minecraft-versions.md § Provenance.
    const out = serializeCommand(
      GIVE,
      value({
        [ITEM]: stack('diamond_pickaxe', {
          lore: [{ text: 'one' }, { text: 'two', color: 'gray' }] satisfies TextComponent[],
        }),
      }),
      ctx,
    )
    expect(out).toBe(
      '/give @p minecraft:diamond_pickaxe[lore=[\'{"text":"one"}\',' +
        '\'{"text":"two","color":"gray"}\']]',
    )
  })

  test('itemFormat nbt emits the item without components rather than the wrong syntax', () => {
    // No supported version writes the pre-1.20.5 NBT suffix, so the branch exists to
    // refuse rather than to guess. The validator says why; the output never lies.
    const old = ctxFor({ ...v1_21_1.traits, itemFormat: 'nbt' })
    const out = serializeCommand(
      GIVE,
      value({ [ITEM]: stack('netherite_sword', { enchantments: enchantments({ sharpness: 5 }) }) }),
      old,
    )
    expect(out).toBe('/give @p minecraft:netherite_sword')
  })
})

describe('an item stack that is not filled in yet', () => {
  test('no item means no token, and the optional tail still disappears', () => {
    expect(serializeCommand(GIVE, value({}), ctx)).toBe('/give @p')
  })

  test('the fixtures above rely on the selector default rather than setting targets', () => {
    // @p is entity_selector's first legal shorthand for a players-only argument, so
    // none of the canonical fixtures has to set it. This is the test that would fail
    // if that default moved and quietly rewrote all three of them.
    const out = serializeCommand(GIVE, value({ [TARGETS]: '@a', [ITEM]: stack('stone') }), ctx)
    expect(out).toBe('/give @a minecraft:stone')
  })

  test('an added but untouched component is not emitted', () => {
    // Otherwise adding a row would put `[lore=[]]` in the output, which is valid
    // syntax for nothing at all — and reads as having taken effect.
    const out = serializeCommand(
      GIVE,
      value({
        [ITEM]: stack('netherite_sword', { lore: [{ text: '' }], enchantments: enchantments({}) }),
      }),
      ctx,
    )
    expect(out).toBe('/give @p minecraft:netherite_sword')
  })
})
