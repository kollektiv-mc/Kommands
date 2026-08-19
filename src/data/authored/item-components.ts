import type { Diagnostic } from '../../schema/types'
import { writeSnbt, type SnbtValue } from '../../schema/snbt'
import { serializeTextComponent, type TextComponent } from '../../schema/text-component'
import type { SerializeContext } from '../versions/types'

/**
 * The data components an item stack may carry, and how each is written.
 *
 * This is the part Brigadier cannot supply. The command tree describes `item_stack`
 * as one opaque token, so every shape below is hand-authored — which is also why it
 * is a table of specs rather than a switch: adding a component is an entry here, not
 * a branch in a serializer.
 *
 * The ids are checked against the version's `data_component_type` registry by
 * `item-components.test.ts`, so a component that stops existing fails a test rather
 * than being offered to the user for a version that has never heard of it.
 *
 * Shapes verified against SpyglassMC/vanilla-mcdoc (`java/world/component/item.mcdoc`,
 * `java/util/attribute.mcdoc`, `java/util/slot.mcdoc`), whose dispatches carry
 * explicit `#[since]` / `#[until]` guards. See docs/minecraft-versions.md § Provenance.
 */

/** The namespace every vanilla id is written with. */
export const NAMESPACE = 'minecraft:'

/**
 * The namespace an attribute modifier's own id is written with.
 *
 * Since 1.21 a modifier carries a caller-chosen namespaced id — it replaced the
 * `uuid` + `name` pair — and it identifies the modifier when the item is equipped or
 * unequipped. It is the app's value, not Minecraft's, so it does not come from a
 * registry.
 */
export const MODIFIER_NAMESPACE = 'kommands:'

/** Which editor renders a component's value. */
export type ItemComponentEditorKind =
  'enchantment-levels' | 'text-component' | 'text-component-list' | 'attribute-modifiers'

export interface ItemComponentSpec {
  /** The `data_component_type` registry id. Written unprefixed inside the brackets. */
  id: string
  label: string
  editor: ItemComponentEditorKind
  defaultValue: () => unknown
  /**
   * Whether the value carries nothing worth emitting.
   *
   * An added-but-untouched component would otherwise emit `[lore=[]]`, which is
   * valid syntax that says nothing — and the user, having added a row, would read the
   * output as having taken effect.
   */
  isEmpty: (value: unknown) => boolean
  serialize: (value: unknown, ctx: SerializeContext) => string
  validate?: (value: unknown, ctx: SerializeContext) => Diagnostic[]
}

// ── Value shapes ────────────────────────────────────────────────────────────

export interface EnchantmentsValue {
  /** Enchantment registry id → level. */
  levels: Record<string, number>
  /** Removed at 1.21.5 along with the `levels` wrapper. Unset means "do not write it". */
  showInTooltip?: boolean
}

export interface AttributeModifier {
  /** Attribute registry id, already carrying this version's category prefix. */
  type: string
  amount: number
  operation: string
  slot: string
  /** A namespaced id of the caller's choosing. */
  id: string
}

/** mcdoc: `AttributeOperation`. */
export const ATTRIBUTE_OPERATIONS: readonly string[] = [
  'add_value',
  'add_multiplied_base',
  'add_multiplied_total',
]

/**
 * mcdoc: `EquipmentSlotGroup`, minus `saddle`, which arrives at 1.21.5.
 *
 * A slot group that does not exist yet would be offered by the picker and rejected by
 * the game, which is the same class of bug as offering an item from another version.
 */
export const EQUIPMENT_SLOTS: readonly string[] = [
  'any',
  'mainhand',
  'offhand',
  'hand',
  'head',
  'chest',
  'legs',
  'feet',
  'armor',
  'body',
]

/** mcdoc: `EnchantmentLevels` is `int @ 1..255`. */
const MIN_LEVEL = 1
const MAX_LEVEL = 255

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

// ── Specs ───────────────────────────────────────────────────────────────────

const ENCHANTMENTS: ItemComponentSpec = {
  id: 'enchantments',
  label: 'Enchantments',
  editor: 'enchantment-levels',
  defaultValue: (): EnchantmentsValue => ({ levels: {} }),
  isEmpty: (value) => {
    const v = value as EnchantmentsValue
    return Object.keys(v.levels).length === 0 && v.showInTooltip === undefined
  },
  serialize: (value, ctx) => {
    const v = value as EnchantmentsValue
    // Sorted so the emitted string depends on the set of enchantments rather than on
    // the order the user happened to add them.
    const levels: SnbtValue = {
      kind: 'compound',
      entries: Object.keys(v.levels)
        .sort()
        .map((id) => [id, { kind: 'number', value: v.levels[id]! }] as const),
    }
    // The `levels` wrapper and the `show_in_tooltip` beside it were both removed at
    // 1.21.5, so one trait decides both.
    if (ctx.traits.enchantmentsShape === 'flat') return writeSnbt(levels)
    const entries: Array<readonly [string, SnbtValue]> = [['levels', levels]]
    if (v.showInTooltip !== undefined) {
      entries.push(['show_in_tooltip', { kind: 'bool', value: v.showInTooltip }])
    }
    return writeSnbt({ kind: 'compound', entries })
  },
  validate: (value, ctx) => {
    const v = value as EnchantmentsValue
    const out: Diagnostic[] = []
    for (const [id, level] of Object.entries(v.levels)) {
      if (id !== '' && !ctx.registries.has('enchantment', id)) {
        out.push(warn(`${id} is not an enchantment in this version.`))
      }
      if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
        out.push(warn(`Level for ${id || 'an enchantment'} must be ${MIN_LEVEL}–${MAX_LEVEL}.`))
      }
    }
    return out
  },
}

const CUSTOM_NAME: ItemComponentSpec = {
  id: 'custom_name',
  label: 'Custom name',
  editor: 'text-component',
  defaultValue: (): TextComponent => ({ text: '' }),
  isEmpty: (value) => (value as TextComponent).text === '',
  serialize: (value, ctx) => serializeTextComponent(value as TextComponent, ctx),
}

const LORE: ItemComponentSpec = {
  id: 'lore',
  label: 'Lore',
  editor: 'text-component-list',
  defaultValue: (): TextComponent[] => [{ text: '' }],
  isEmpty: (value) => (value as TextComponent[]).every((line) => line.text === ''),
  serialize: (value, ctx) => {
    // A list of text components, one per line. Each element is already a complete
    // component in this version's form — a quoted JSON string before 1.21.5 — so it
    // goes in raw rather than being encoded a second time.
    const lines = (value as TextComponent[]).filter((line) => line.text !== '')
    return writeSnbt({
      kind: 'list',
      items: lines.map((line) => ({ kind: 'raw', text: serializeTextComponent(line, ctx) })),
    })
  },
}

const ATTRIBUTE_MODIFIERS: ItemComponentSpec = {
  id: 'attribute_modifiers',
  label: 'Attribute modifiers',
  editor: 'attribute-modifiers',
  defaultValue: (): AttributeModifier[] => [],
  isEmpty: (value) => (value as AttributeModifier[]).length === 0,
  serialize: (value, _ctx) => {
    const modifiers = value as AttributeModifier[]
    // Field order is fixed here rather than sorted: this is the order the canonical
    // fixture is written in, and SNBT compounds are unordered to the game but not to
    // a byte-exact comparison.
    const items: SnbtValue[] = modifiers.map((m) => ({
      kind: 'compound',
      entries: [
        ['type', { kind: 'string', value: `${NAMESPACE}${m.type}` }],
        ['amount', { kind: 'number', value: m.amount }],
        ['operation', { kind: 'string', value: m.operation }],
        ['slot', { kind: 'string', value: m.slot }],
        ['id', { kind: 'string', value: m.id }],
      ],
    }))
    // The `{modifiers:[…]}` wrapper is this version's canonical form; from 1.21.5 the
    // component is a bare array. No trait describes that yet — see the roadmap issue
    // rather than guessing a fourth flag here.
    return writeSnbt({ kind: 'compound', entries: [['modifiers', { kind: 'list', items }]] })
  },
  validate: (value, ctx) => {
    const out: Diagnostic[] = []
    for (const m of value as AttributeModifier[]) {
      if (m.type !== '' && !ctx.registries.has('attribute', m.type)) {
        // The id is read from the registry already spelled for this version. 1.21.1
        // uses three category prefixes, so computing one would emit an id that has
        // never existed — see docs/minecraft-versions.md § Registry drift.
        out.push(warn(`${m.type} is not an attribute in this version.`))
      }
      if (!Number.isFinite(m.amount)) out.push(warn('A modifier amount must be a number.'))
      if (!m.id.includes(':')) out.push(warn(`Modifier id ${m.id} needs a namespace.`))
    }
    return out
  },
}

/** Alphabetical, which is both the emission order and the registry's own order. */
export const ITEM_COMPONENTS: readonly ItemComponentSpec[] = [
  ATTRIBUTE_MODIFIERS,
  CUSTOM_NAME,
  ENCHANTMENTS,
  LORE,
]

const BY_ID = new Map(ITEM_COMPONENTS.map((spec) => [spec.id, spec]))

/** The spec for a component id, or undefined for one with no authored editor yet. */
export function itemComponent(id: string): ItemComponentSpec | undefined {
  return BY_ID.get(id)
}
