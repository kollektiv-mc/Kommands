import type { SerializeContext } from '../../data/versions/types'
import type { EnchantmentsValue } from '../../data/authored/item-components'
import { RegistryPicker } from './RegistryPicker'
import { FIELD, LABEL } from './fieldStyles'
import { ROW_ADD, ROW_REMOVE, ROW } from './rowStyles'

/**
 * The `enchantments` component: enchantment ids and their levels.
 *
 * Rows are held as an array while editing and collapsed to a map on change, because
 * a map cannot express a half-typed id — the key would change on every keystroke and
 * take its value with it.
 */
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
          <input
            type="number"
            className={FIELD}
            value={level}
            aria-label="Level"
            onChange={(e) =>
              setRows(rows.map((r, i) => (i === index ? [r[0], Number(e.target.value)] : r)))
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
          <label className="flex items-center gap-1">
            <span className={LABEL}>tooltip</span>
            <select
              className={FIELD}
              aria-label="Show in tooltip"
              value={value.showInTooltip === undefined ? '' : String(value.showInTooltip)}
              onChange={(e) =>
                onChange({
                  ...value,
                  showInTooltip: e.target.value === '' ? undefined : e.target.value === 'true',
                })
              }
            >
              <option value="">default</option>
              <option value="true">show</option>
              <option value="false">hide</option>
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
