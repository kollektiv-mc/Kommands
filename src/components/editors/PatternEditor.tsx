import type { SerializeContext } from '../../data/versions/types'
import {
  isKnownBlock,
  PATTERN_REGISTRY,
  type PatternEntry,
  type PatternValue,
} from '../../schema/argument-types/we-pattern'
import { RegistryPicker } from './RegistryPicker'
import { FIELD, LABEL } from './fieldStyles'
import { ROW, ROW_ADD, ROW_REMOVE } from './rowStyles'

/**
 * Backs `we_pattern`.
 *
 * Rows rather than a single text field, because the weighted form is where the syntax
 * is easy to get wrong: the separator is a comma, the weight is a suffix `%` on the
 * front of the block, and a weight on a lone entry does not parse at all. A row list
 * makes all three unavailable to get wrong.
 *
 * Block ids come from `ctx.registries`, never from a list held here — they are
 * versioned data, and a component that knew them would be right for one version.
 */
interface PatternEditorProps {
  value: PatternValue
  onChange: (next: PatternValue) => void
  ctx: SerializeContext
}

export function PatternEditor({ value, onChange, ctx }: PatternEditorProps) {
  const entries = ctx.registries.entries(PATTERN_REGISTRY)
  const rows = value.entries

  const setRows = (next: readonly PatternEntry[]) => onChange({ ...value, entries: next })
  const replace = (index: number, patch: Partial<PatternEntry>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  // The weight column is only offered once there is something to weight against. With
  // one block the field would invite a value that WorldEdit refuses to parse.
  const weighted = rows.length > 1

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={index} className={ROW}>
          {weighted && (
            <label className="flex flex-col gap-1">
              <span className={LABEL}>chance</span>
              <input
                type="number"
                className={FIELD}
                min={0}
                value={row.weight}
                aria-label={`Chance for block ${index + 1}`}
                onChange={(e) =>
                  replace(index, { weight: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </label>
          )}
          <RegistryPicker
            value={row.block}
            entries={entries}
            ariaLabel={`Block ${index + 1}`}
            invalid={!isKnownBlock(row.block, ctx)}
            onChange={(next) => replace(index, { block: next })}
          />
          <button
            type="button"
            className={ROW_REMOVE}
            aria-label={`Remove block ${index + 1}`}
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            − remove
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={ROW_ADD}
          onClick={() => setRows([...rows, { block: '', weight: '' }])}
        >
          + block
        </button>
        {weighted && (
          <span className="text-text-faint text-3xs">
            chances are relative, so they need not total 100
          </span>
        )}
      </div>
    </div>
  )
}
