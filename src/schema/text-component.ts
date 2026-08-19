import type { SerializeContext } from '../data/versions/types'
import { writeSnbt, type SnbtValue } from './snbt'
import { TEXT_COLORS } from '../data/authored/text-colors'
import { namespaced } from '../data/authored/namespace'
import type { ArgumentOptions, Diagnostic } from './types'

/**
 * Text components, as a structured tree.
 *
 * The value model is a tree and not a string on purpose. JSON versus SNBT is then a
 * trait branch at the boundary rather than two string builders that drift apart.
 * Building this as a string first and adding SNBT later is the rewrite that decision
 * avoids.
 *
 * There are two boundaries, not one, and the difference is easy to miss: a component
 * written as a command *argument* is bare, and the same component written into an
 * item's *data-component field* is a quoted string before 1.21.5. See
 * `serializeTextComponent` and `textComponentField`.
 *
 * Shapes verified against SpyglassMC/vanilla-mcdoc (`java/util/text.mcdoc`, whose
 * `#[since]` / `#[until]` guards are explicit) and cross-checked against Kyori
 * Adventure's `JSONOptions`, which gates emission per Minecraft version. See
 * docs/minecraft-versions.md § Provenance.
 */

// ── The value model ─────────────────────────────────────────────────────────

/**
 * What a component says.
 *
 * A union rather than a bag of optional fields, because the variants are genuinely
 * exclusive — a component carries exactly one — and because each brings companion
 * fields the others do not. A `score` needs *both* an objective and a holder; a flat
 * shape would happily express half of one, and half a score is a component the game
 * drops on the floor.
 */
export type TextContent =
  | { kind: 'text'; text: string }
  | { kind: 'translate'; translate: string; fallback?: string; with?: TextComponent[] }
  | { kind: 'selector'; selector: string; separator?: TextComponent }
  | { kind: 'score'; objective: string; name: string }

/** The kinds, in the order the editor offers them. */
export const TEXT_CONTENT_KINDS = ['text', 'translate', 'selector', 'score'] as const

export type TextContentKind = TextContent['kind']

/**
 * What happens when the text is clicked.
 *
 * Every action's payload is one string at 1.21.1, which is why this is a single shape
 * rather than a union. From 1.21.5 the payload key varies per action — that is a
 * concern of the wire form below, not of the value.
 */
export type ClickAction =
  'open_url' | 'run_command' | 'suggest_command' | 'change_page' | 'copy_to_clipboard'

export const CLICK_ACTIONS: readonly ClickAction[] = [
  'open_url',
  'run_command',
  'suggest_command',
  'change_page',
  'copy_to_clipboard',
]

export interface ClickEvent {
  action: ClickAction
  value: string
}

/**
 * What is shown on hover.
 *
 * The field names here are the *meaning*, not the wire spelling. At 1.21.1 an entity's
 * type is written under `type` and its uuid under `id`; from 1.21.5 those two rotate,
 * so a value model that used the wire names would have to be rewritten to add a
 * version rather than extended.
 */
export type HoverEvent =
  | { action: 'show_text'; contents: TextComponent }
  | { action: 'show_item'; id: string; count?: number }
  | { action: 'show_entity'; entityType: string; id: string; name?: TextComponent }

export type HoverAction = HoverEvent['action']

export const HOVER_ACTIONS: readonly HoverAction[] = ['show_text', 'show_item', 'show_entity']

export interface TextComponent {
  content: TextContent
  /** A colour name or a hex triplet. Comes from authored data, never a component literal. */
  color?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
  extra?: TextComponent[]
  clickEvent?: ClickEvent
  hoverEvent?: HoverEvent
}

/** A fresh, empty component. The shape the editor seeds every new node with. */
export function emptyTextComponent(): TextComponent {
  return { content: { kind: 'text', text: '' } }
}

/**
 * Whether a component says nothing yet.
 *
 * Emptiness is a property of the *content*, not of the `text` field — a translate-only
 * component has no text at all. One exported rule because three call sites need to
 * agree: this type's own serializer, `custom_name`, and each `lore` line. When they
 * disagreed, a component one of them considered empty was silently dropped by another.
 */
export function isEmptyTextComponent(value: TextComponent): boolean {
  const content = value.content
  switch (content.kind) {
    case 'text':
      return content.text === ''
    case 'translate':
      return content.translate === ''
    case 'selector':
      return content.selector === ''
    case 'score':
      return content.objective === '' || content.name === ''
  }
}

// ── The wire form ───────────────────────────────────────────────────────────

/**
 * A component as this version writes it: ordered key/value pairs, already carrying the
 * version's own spellings.
 *
 * One traversal, two renderings. The shape this replaced walked the value twice — once
 * building JSON and once building SNBT — and the SNBT walk silently skipped any field
 * that was not a string, a boolean or `extra`. That is invisible while every field is
 * one of those three, and stops being invisible the moment a `score` or an event is
 * added: the JSON form would carry it and the SNBT form would not, which no test
 * asserting one form can catch. Here a field either reaches both or neither.
 */
type WireValue = string | number | boolean | WireValue[] | WireObject

interface WireObject {
  entries: ReadonlyArray<readonly [string, WireValue]>
}

const isWireObject = (value: WireValue): value is WireObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Build the wire form for the target version.
 *
 * Every version branch in this file lives here, and all of them are on
 * `textComponentFormat`. That trait is named for JSON versus SNBT, and the key
 * renames below happen to land on the same version it flips at — 1.21.5 moved the
 * format, the event wrapper names and the event payload names together. If a future
 * version ever separates them, this is the place that needs a second trait rather
 * than a rewrite.
 */
function toWire(value: TextComponent, ctx: SerializeContext): WireObject {
  const modern = ctx.traits.textComponentFormat === 'snbt'
  const entries: Array<readonly [string, WireValue]> = []

  const content = value.content
  switch (content.kind) {
    case 'text':
      entries.push(['text', content.text])
      break
    case 'translate': {
      entries.push(['translate', content.translate])
      if (content.fallback !== undefined) entries.push(['fallback', content.fallback])
      const args = (content.with ?? []).filter((c) => !isEmptyTextComponent(c))
      // Omitted rather than emitted empty: mcdoc types it `[Text] @ 1..`, so a
      // zero-length list is not a smaller value, it is an invalid one.
      if (args.length > 0) entries.push(['with', args.map((c) => toWire(c, ctx))])
      break
    }
    case 'selector':
      entries.push(['selector', content.selector])
      if (content.separator && !isEmptyTextComponent(content.separator)) {
        entries.push(['separator', toWire(content.separator, ctx)])
      }
      break
    case 'score':
      // objective before name, matching the struct's own field order.
      entries.push([
        'score',
        {
          entries: [
            ['objective', content.objective],
            ['name', content.name],
          ],
        },
      ])
      break
  }

  if (value.color !== undefined) entries.push(['color', value.color])
  for (const flag of FLAGS) {
    const set = value[flag]
    if (set !== undefined) entries.push([flag, set])
  }

  if (value.clickEvent) {
    entries.push([modern ? 'click_event' : 'clickEvent', clickWire(value.clickEvent, modern)])
  }
  if (value.hoverEvent) {
    entries.push([modern ? 'hover_event' : 'hoverEvent', hoverWire(value.hoverEvent, ctx, modern)])
  }

  const children = (value.extra ?? []).filter((c) => !isEmptyTextComponent(c))
  if (children.length > 0) entries.push(['extra', children.map((c) => toWire(c, ctx))])

  return { entries }
}

const FLAGS = ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'] as const

/**
 * Before 1.21.5 every action's payload is one key, `value`, always a string. From
 * 1.21.5 each action names its own.
 *
 * `change_page` stays a string in both. mcdoc moves it to an int at 1.21.5 and Kyori
 * Adventure moves it at 1.21.6; the two disagree, and nothing here can settle it. At
 * the version this project targets it is a string either way, so the honest thing is
 * to keep the shape that is verified rather than pick a side on the one that is not.
 */
function clickWire(event: ClickEvent, modern: boolean): WireObject {
  const key = modern ? MODERN_CLICK_KEYS[event.action] : 'value'
  return {
    entries: [
      ['action', event.action],
      [key, event.value],
    ],
  }
}

const MODERN_CLICK_KEYS: Record<ClickAction, string> = {
  open_url: 'url',
  run_command: 'command',
  suggest_command: 'command',
  change_page: 'page',
  copy_to_clipboard: 'value',
}

/**
 * Before 1.21.5 the payload sits under `contents`. From 1.21.5 `show_text` moves it to
 * `value` and the other two spread their fields into the event itself — and
 * `show_entity`'s two ids swap keys while doing it.
 */
function hoverWire(event: HoverEvent, ctx: SerializeContext, modern: boolean): WireObject {
  const action: readonly [string, WireValue] = ['action', event.action]

  switch (event.action) {
    case 'show_text': {
      const body = toWire(event.contents, ctx)
      return { entries: [action, [modern ? 'value' : 'contents', body]] }
    }
    case 'show_item': {
      // Written as a full resource location, though the registry the picker reads
      // holds bare ids.
      const fields: Array<readonly [string, WireValue]> = [['id', namespaced(event.id)]]
      if (event.count !== undefined) fields.push(['count', event.count])
      return modern
        ? { entries: [action, ...fields] }
        : { entries: [action, ['contents', { entries: fields }]] }
    }
    case 'show_entity': {
      const type = namespaced(event.entityType)
      // The two ids swap keys at 1.21.5: the entity type moves from `type` to `id`,
      // and the uuid from `id` to `uuid`. Nothing warns when they are crossed.
      const fields: Array<readonly [string, WireValue]> = modern
        ? [
            ['id', type],
            ['uuid', event.id],
          ]
        : [
            ['type', type],
            ['id', event.id],
          ]
      if (event.name && !isEmptyTextComponent(event.name)) {
        fields.push(['name', toWire(event.name, ctx)])
      }
      return modern
        ? { entries: [action, ...fields] }
        : { entries: [action, ['contents', { entries: fields }]] }
    }
  }
}

// ── The two renderings ──────────────────────────────────────────────────────

function wireToJson(value: WireValue): unknown {
  if (Array.isArray(value)) return value.map(wireToJson)
  if (isWireObject(value)) {
    // A plain object built in entry order: JSON.stringify preserves insertion order
    // for string keys, which is what makes the emitted string comparable byte-for-byte.
    const out: Record<string, unknown> = {}
    for (const [key, v] of value.entries) out[key] = wireToJson(v)
    return out
  }
  return value
}

function wireToSnbt(value: WireValue): SnbtValue {
  if (Array.isArray(value)) return { kind: 'list', items: value.map(wireToSnbt) }
  if (isWireObject(value)) {
    return { kind: 'compound', entries: value.entries.map(([k, v]) => [k, wireToSnbt(v)] as const) }
  }
  if (typeof value === 'string') return { kind: 'string', value }
  if (typeof value === 'boolean') return { kind: 'bool', value }
  return { kind: 'number', value }
}

/**
 * A text component written where a command argument expects one directly.
 *
 * `/tellraw @a {…}` — bare, with no surrounding quotes. The branch is on
 * `textComponentFormat`, which is `json-string` up to 1.21.4 and `snbt` from 1.21.5.
 */
export function serializeTextComponent(value: TextComponent, ctx: SerializeContext): string {
  const wire = toWire(value, ctx)
  return ctx.traits.textComponentFormat === 'snbt'
    ? writeSnbt(wireToSnbt(wire))
    : JSON.stringify(wireToJson(wire))
}

/**
 * The same component written into a *data-component field*, which is not the same
 * thing and is the mistake worth naming.
 *
 * `custom_name`, `item_name` and each `lore` line are typed
 * `#[until="1.21.5"] #[text_component] string` — before 1.21.5 the field holds a
 * **string** whose contents are the JSON, so it is quoted. From 1.21.5 the field holds
 * the component itself and there is nothing to quote. Passing the argument form of the
 * same value into an item produces a command that parses and does nothing.
 *
 * Single quotes rather than double, so the JSON's own quotes need no escaping. The two
 * characters that do — a quote of that kind, and a backslash — are escaped here, on top
 * of the escaping JSON has already done.
 */
export function textComponentField(value: TextComponent, ctx: SerializeContext): SnbtValue {
  const wire = toWire(value, ctx)
  if (ctx.traits.textComponentFormat === 'snbt') return wireToSnbt(wire)
  const json = JSON.stringify(wireToJson(wire)).replace(/(['\\])/g, '\\$1')
  return { kind: 'raw', text: `'${json}'` }
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Warnings for a component and everything under it.
 *
 * Warns, never blocks — the output always renders and the user decides. What is worth
 * warning about is the half-filled shape a form makes easy and the game silently
 * discards: a score with a holder but no objective, a click action whose payload does
 * not match the form that action requires at this version.
 */
export function validateTextComponent(
  value: TextComponent,
  _options: ArgumentOptions,
  ctx: SerializeContext,
): Diagnostic[] {
  const out: Diagnostic[] = []
  collect(value, ctx, out)
  return out
}

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

/** A colour is one of the named set, or a hex triplet. Both are legal at every version here. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function collect(value: TextComponent, ctx: SerializeContext, out: Diagnostic[]): void {
  const content = value.content
  switch (content.kind) {
    case 'score':
      // Half a score is the case worth catching: the form makes it easy to fill one
      // box and move on, and the game wants both.
      if (content.objective === '' && content.name !== '')
        out.push(warn('A score needs an objective.'))
      if (content.name === '' && content.objective !== '') out.push(warn('A score needs a holder.'))
      break
    case 'translate':
      for (const argument of content.with ?? []) collect(argument, ctx, out)
      break
    case 'selector':
      if (content.separator) collect(content.separator, ctx, out)
      break
    case 'text':
      break
  }

  if (value.color !== undefined && value.color !== '') {
    if (!TEXT_COLORS.includes(value.color) && !HEX_COLOR.test(value.color)) {
      out.push(warn(`${value.color} is not a colour name, and not a six-digit hex triplet.`))
    }
  }

  if (value.clickEvent) out.push(...clickDiagnostics(value.clickEvent))
  if (value.hoverEvent) out.push(...hoverDiagnostics(value.hoverEvent, ctx, out))

  for (const child of value.extra ?? []) collect(child, ctx, out)
}

function clickDiagnostics(event: ClickEvent): Diagnostic[] {
  if (event.value === '') return []
  // Verified against mcdoc: run_command is `#[command(slash="required")]` at this
  // version, while suggest_command is `slash="chat"` and does not need one.
  if (event.action === 'run_command' && !event.value.startsWith('/')) {
    return [warn('A run_command click needs a leading slash.')]
  }
  if (event.action === 'change_page') {
    const page = Number(event.value)
    if (!Number.isInteger(page) || page < 1)
      return [warn('A page must be a whole number, 1 or more.')]
  }
  return []
}

function hoverDiagnostics(
  event: HoverEvent,
  ctx: SerializeContext,
  out: Diagnostic[],
): Diagnostic[] {
  switch (event.action) {
    case 'show_text':
      collect(event.contents, ctx, out)
      return []
    case 'show_item':
      return event.id !== '' && !ctx.registries.has('item', event.id)
        ? [warn(`${event.id} is not an item in this version.`)]
        : []
    case 'show_entity': {
      const found: Diagnostic[] = []
      if (event.entityType !== '' && !ctx.registries.has('entity_type', event.entityType)) {
        found.push(warn(`${event.entityType} is not an entity type in this version.`))
      }
      if (event.name) collect(event.name, ctx, out)
      return found
    }
  }
}
