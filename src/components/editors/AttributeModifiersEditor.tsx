import type { SerializeContext } from '../../data/versions/types'
import {
  ATTRIBUTE_OPERATIONS,
  EQUIPMENT_SLOTS,
  MODIFIER_NAMESPACE,
  type AttributeModifier,
} from '../../data/authored/item-components'
import { RegistryPicker } from './RegistryPicker'
import { FIELD, LABEL } from './fieldStyles'
import { ROW, ROW_ADD, ROW_REMOVE } from './rowStyles'

/**
 * The `attribute_modifiers` component.
 *
 * The attribute id is offered straight from the version's registry, already carrying
 * whichever category prefix that version spells it with. Nothing here computes a
 * prefix: 1.21.1 uses three of them, so a serializer that prepended one would emit an
 * id that has never existed in any version.
 */
interface AttributeModifiersEditorProps {
  value: AttributeModifier[]
  onChange: (next: AttributeModifier[]) => void
  ctx: SerializeContext
}

function blank(): AttributeModifier {
  return {
    type: '',
    amount: 1,
    operation: ATTRIBUTE_OPERATIONS[0]!,
    slot: EQUIPMENT_SLOTS[0]!,
    id: `${MODIFIER_NAMESPACE}modifier`,
  }
}

export function AttributeModifiersEditor({ value, onChange, ctx }: AttributeModifiersEditorProps) {
  const entries = ctx.registries.entries('attribute')

  const update = (index: number, patch: Partial<AttributeModifier>) =>
    onChange(value.map((m, i) => (i === index ? { ...m, ...patch } : m)))

  return (
    <div className="flex flex-col gap-2">
      {value.map((modifier, index) => (
        <div key={index} className={ROW}>
          <RegistryPicker
            value={modifier.type}
            entries={entries}
            ariaLabel="Attribute"
            invalid={modifier.type !== '' && !ctx.registries.has('attribute', modifier.type)}
            onChange={(next) => update(index, { type: next })}
          />
          <label className="flex flex-col gap-1">
            <span className={LABEL}>amount</span>
            <input
              type="number"
              className={FIELD}
              value={modifier.amount}
              aria-label="Amount"
              step="any"
              onChange={(e) => update(index, { amount: Number(e.target.value) })}
            />
          </label>
          <select
            className={FIELD}
            value={modifier.operation}
            aria-label="Operation"
            onChange={(e) => update(index, { operation: e.target.value })}
          >
            {ATTRIBUTE_OPERATIONS.map((operation) => (
              <option key={operation} value={operation}>
                {operation}
              </option>
            ))}
          </select>
          <select
            className={FIELD}
            value={modifier.slot}
            aria-label="Slot"
            onChange={(e) => update(index, { slot: e.target.value })}
          >
            {EQUIPMENT_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>id</span>
            <input
              type="text"
              className={FIELD}
              value={modifier.id}
              aria-label="Modifier id"
              onChange={(e) => update(index, { id: e.target.value })}
            />
          </label>
          <button
            type="button"
            className={ROW_REMOVE}
            aria-label="Remove modifier"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            − remove
          </button>
        </div>
      ))}
      <button type="button" className={ROW_ADD} onClick={() => onChange([...value, blank()])}>
        + modifier
      </button>
    </div>
  )
}
