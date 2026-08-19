import { useState } from 'react'
import type { SerializeContext } from '../../data/versions/types'
import {
  ITEM_COMPONENTS,
  itemComponent,
  type AttributeModifier,
  type EnchantmentsValue,
  type ItemComponentSpec,
} from '../../data/authored/item-components'
import { emptyTextComponent, type TextComponent } from '../../schema/text-component'
import type { ItemStackValue } from '../../schema/argument-types/item-stack'
import type { EditorProps } from '../../schema/types'
import { AttributeModifiersEditor } from './AttributeModifiersEditor'
import { EnchantmentLevelsEditor } from './EnchantmentLevelsEditor'
import { RegistryPicker } from './RegistryPicker'
import { TextComponentFields } from './TextComponentEditor'
import { FIELD, LABEL } from './fieldStyles'
import { ROW, ROW_ADD, ROW_GROUP, ROW_REMOVE } from './rowStyles'

/**
 * Backs `item_stack` — an item, and the data components it carries.
 *
 * Which components exist and what each one means is data
 * (src/data/authored/item-components.ts). This component only knows how to lay a
 * spec out, so adding a component is an entry in that table; only a genuinely new
 * kind of input reaches this file.
 */
export function ItemStackEditor({ value, onChange, ctx }: EditorProps<ItemStackValue>) {
  const present = Object.keys(value.components).sort()
  const absent = ITEM_COMPONENTS.filter((spec) => !(spec.id in value.components))

  const setComponent = (id: string, next: unknown) =>
    onChange({ ...value, components: { ...value.components, [id]: next } })

  const removeComponent = (id: string) => {
    const { [id]: _removed, ...rest } = value.components
    onChange({ ...value, components: rest })
  }

  return (
    <div className="flex flex-col gap-2">
      <RegistryPicker
        value={value.id}
        entries={ctx.registries.entries('item')}
        ariaLabel="Item"
        // Checked here rather than read off `diagnostics`, which covers the whole
        // stack: an enchantment row with no enchantment would otherwise mark the item
        // field red for a problem that is not the item's.
        invalid={value.id !== '' && !ctx.registries.has('item', value.id)}
        onChange={(next) => onChange({ ...value, id: next })}
      />

      {present.map((id) => {
        const spec = itemComponent(id)
        if (!spec) return null
        return (
          <div key={id} className={ROW_GROUP}>
            <div className="flex items-center gap-2">
              <span className={LABEL}>{spec.label}</span>
              <button
                type="button"
                className={ROW_REMOVE}
                aria-label={`Remove ${spec.label}`}
                onClick={() => removeComponent(id)}
              >
                − remove
              </button>
            </div>
            <ComponentValue
              spec={spec}
              value={value.components[id]}
              ctx={ctx}
              onChange={(next) => setComponent(id, next)}
            />
          </div>
        )
      })}

      {absent.length > 0 && <AddComponent options={absent} onAdd={setComponent} />}
    </div>
  )
}

function AddComponent({
  options,
  onAdd,
}: {
  options: readonly ItemComponentSpec[]
  onAdd: (id: string, value: unknown) => void
}) {
  const [choice, setChoice] = useState('')
  return (
    <div className="flex items-center gap-2">
      <select
        className={FIELD}
        value={choice}
        aria-label="Add component"
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value="">choose a component…</option>
        {options.map((spec) => (
          <option key={spec.id} value={spec.id}>
            {spec.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={ROW_ADD}
        disabled={choice === ''}
        onClick={() => {
          const spec = options.find((s) => s.id === choice)
          if (!spec) return
          onAdd(spec.id, spec.defaultValue())
          setChoice('')
        }}
      >
        + add
      </button>
    </div>
  )
}

interface ComponentValueProps {
  spec: ItemComponentSpec
  value: unknown
  ctx: SerializeContext
  onChange: (next: unknown) => void
}

/**
 * Lay out one component's value.
 *
 * The switch is on the spec's editor *kind*, not on the component id — four shapes
 * cover the catalogue, and a fifth entry that reuses one of them adds no code here.
 */
function ComponentValue({ spec, value, ctx, onChange }: ComponentValueProps) {
  switch (spec.editor) {
    case 'enchantment-levels':
      return (
        <EnchantmentLevelsEditor
          value={value as EnchantmentsValue}
          ctx={ctx}
          onChange={(next) => onChange(next)}
        />
      )
    case 'attribute-modifiers':
      return (
        <AttributeModifiersEditor
          value={value as AttributeModifier[]}
          ctx={ctx}
          onChange={(next) => onChange(next)}
        />
      )
    case 'text-component':
      return (
        <TextComponentFields
          value={value as TextComponent}
          ariaPrefix={spec.label}
          ctx={ctx}
          onChange={(next) => onChange(next)}
        />
      )
    case 'text-component-list':
      return (
        <TextComponentList
          value={value as TextComponent[]}
          label={spec.label}
          ctx={ctx}
          onChange={onChange}
        />
      )
  }
}

function TextComponentList({
  value,
  label,
  ctx,
  onChange,
}: {
  value: TextComponent[]
  label: string
  ctx: SerializeContext
  onChange: (next: TextComponent[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((line, index) => (
        <div key={index} className={ROW}>
          <TextComponentFields
            value={line}
            ariaPrefix={`${label} line ${index + 1}`}
            ctx={ctx}
            onChange={(next) => onChange(value.map((l, i) => (i === index ? next : l)))}
          />
          <button
            type="button"
            className={ROW_REMOVE}
            aria-label={`Remove ${label} line ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            − remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className={ROW_ADD}
        onClick={() => onChange([...value, emptyTextComponent()])}
      >
        + line
      </button>
    </div>
  )
}
