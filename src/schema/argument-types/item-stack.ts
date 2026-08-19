import type { SerializeContext } from '../../data/versions/types'
import { itemComponent } from '../../data/authored/item-components'
import { namespaced } from '../../data/authored/namespace'
import type { Diagnostic } from '../types'

/**
 * An item and the data components it carries.
 *
 * Brigadier describes this whole thing as one opaque token, so everything below the
 * item id is hand-authored — the catalogue in src/data/authored/item-components.ts
 * says what each component means, and this file says how an item stack is assembled
 * out of them.
 */
export interface ItemStackValue {
  /** Registry id without a namespace. Empty means the user has not picked one. */
  id: string
  /** Data-component id → that component's value. */
  components: Readonly<Record<string, unknown>>
}

export const EMPTY_ITEM_STACK: ItemStackValue = { id: '', components: {} }

const warn = (message: string): Diagnostic => ({ severity: 'warning', message })

/**
 * Write an item stack for the target version.
 *
 * Components are emitted in sorted id order so the output depends on which ones are
 * set rather than on the order they were added — two users building the same item get
 * the same string, and a fixture can be compared byte-for-byte.
 */
export function serializeItemStack(value: ItemStackValue, ctx: SerializeContext): string {
  if (value.id === '') return ''
  const item = namespaced(value.id)

  // Before 1.20.5 an item's extra data was an NBT suffix rather than a component
  // list, and the two are not interconvertible. No supported version writes that
  // form, so rather than build a second syntax nothing exercises, the item is emitted
  // bare and `validate` says why the components are missing.
  if (ctx.traits.itemFormat !== 'components') return item

  const parts: string[] = []
  for (const id of Object.keys(value.components).sort()) {
    const spec = itemComponent(id)
    if (!spec) continue
    const componentValue = value.components[id]
    if (spec.isEmpty(componentValue)) continue
    parts.push(`${id}=${spec.serialize(componentValue, ctx)}`)
  }
  return parts.length > 0 ? `${item}[${parts.join(',')}]` : item
}

export function validateItemStack(value: ItemStackValue, ctx: SerializeContext): Diagnostic[] {
  const out: Diagnostic[] = []
  if (value.id === '') return out

  if (!ctx.registries.has('item', value.id)) {
    out.push(warn(`${value.id} is not an item in this version.`))
  }

  const componentIds = Object.keys(value.components)
  if (componentIds.length > 0 && ctx.traits.itemFormat !== 'components') {
    out.push(warn('This version writes item data as NBT, so data components are not emitted.'))
  }

  for (const id of componentIds) {
    const spec = itemComponent(id)
    if (!spec) {
      out.push(warn(`${id} has no editor yet, so it is left out of the command.`))
      continue
    }
    if (spec.validate) out.push(...spec.validate(value.components[id], ctx))
  }
  return out
}
