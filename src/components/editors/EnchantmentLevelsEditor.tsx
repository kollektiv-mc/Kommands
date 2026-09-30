import type { SerializeContext } from '../../data/versions/types'
import type { EnchantmentsValue } from '../../data/authored/item-components'
import { RegistryPicker } from './RegistryPicker'
import { SUB_LABEL } from './fieldStyles'
import { Segmented } from '../ui/Segmented'
import { Stepper } from '../ui/Stepper'
import { ROW_ADD, ROW_REMOVE, ROW } from './rowStyles'

/**
 * The `enchantments` component: enchantment ids and their levels.
 *
 * Rows are held as an array while editing and collapsed to a map on change, because
 * a map cannot express a half-typed id — the key would change on every keystroke and
 * take its value with it.
 */
const TOOLTIP_OPTIONS = [
  { value: '', label: 'default' },
  { value: 'true', label: 'show' },
  { value: 'false', label: 'hide' },
] as const

interface EnchantmentLevelsEditorProps {
  value: EnchantmentsValue
  onChange: (next: EnchantmentsValue) => void
  ctx: SerializeContext
}

export function EnchantmentLevelsEditor({ value, onChange, ctx }: EnchantmentLevelsEditorProps) {
  const rows = Object.entries(value.levels)
  const entries = ctx.registries.entries('enchantment')

  const setRows = (next: Array<[string, number]>) =>
    onChange({ ...value, levels: Object.fromEntries(next) })

  return (
    <div className="flex flex-col gap-2">
      {rows.map(([id, level], index) => (
        <div key={index} className={ROW}>
          <RegistryPicker
            value={id}
            entries={entries}
            ariaLabel="Enchantment"
            invalid={id !== '' && !ctx.registries.has('enchantment', id)}
            onChange={(next) => setRows(rows.map((r, i) => (i === index ? [next, r[1]] : r)))}
          />
          <Stepper
            value={level}
            min={1}
            max={255}
            aria-label="Level"
            onChange={(next) =>
              setRows(rows.map((r, i) => (i === index ? [r[0], next === '' ? 0 : next] : r)))
            }
          />
          <button
            type="button"
            className={ROW_REMOVE}
            aria-label="Remove enchantment"
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            − remove
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button type="button" className={ROW_ADD} onClick={() => setRows([...rows, ['', 1]])}>
          + enchantment
        </button>

        {/* The `levels` wrapper and this field were removed together at 1.21.5, so one
            trait decides whether either is offered. */}
        {ctx.traits.enchantmentsShape === 'levels-wrapper' && (
          <div className="flex items-center gap-2">
            <span className={SUB_LABEL}>tooltip</span>
            <Segmented
              aria-label="Show in tooltip"
              value={value.showInTooltip === undefined ? '' : String(value.showInTooltip)}
              options={TOOLTIP_OPTIONS}
              onChange={(next) =>
                onChange({ ...value, showInTooltip: next === '' ? undefined : next === 'true' })
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
