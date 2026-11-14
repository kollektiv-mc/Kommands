import { useMemo } from 'react'
import type { SerializeContext } from '../../data/versions/types'
import {
  isKnownBlock,
  PATTERN_REGISTRY,
  TAG_REGISTRY,
  DEFAULT_STATE as DEFAULT,
  RANDOM_STATE as RANDOM,
  withProperty,
  type PatternEntry,
  type PatternKind,
  type PatternValue,
} from '../../schema/argument-types/we-pattern'
import type { ListOption } from '../../lib/listbox'
import { Combobox } from '../ui/Combobox'
import { Listbox } from '../ui/Listbox'
import { ChipField } from './ChipField'
import { RegistryPicker } from './RegistryPicker'
import { FIELD, FOCUS, SUB_LABEL } from './fieldStyles'
import { ROW_ADD, ROW_GROUP } from './rowStyles'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'

/**
 * Backs `we_pattern`.
 *
 * Rows rather than a single text field, because the weighted form is where the syntax
 * is easy to get wrong: the separator is a comma, the weight is a suffix `%` on the
 * front of the entry, and a weight on a lone entry does not parse at all. A row list
 * makes all three unavailable to get wrong.
 *
 * Each row is one of the four kinds `we-pattern.ts` describes. A block offers its own
 * properties, read from the version's block data, each left at its default, set, or
 * random; that is the one place the grammar is subtle, since `*` randomises only what
 * the brackets leave out, so choosing random for one property writes the others out.
 *
 * Block ids come from `ctx.registries`, never from a list held here: they are
 * versioned data, and a component that knew them would be right for one version.
 */
interface PatternEditorProps {
  value: PatternValue
  onChange: (next: PatternValue) => void
  ctx: SerializeContext
}

const KINDS: readonly ListOption<PatternKind>[] = [
  { value: 'block', label: 'Block' },
  { value: 'tag', label: 'Tag' },
  { value: 'apply', label: 'Change existing' },
  { value: 'clipboard', label: 'Clipboard' },
]

export function PatternEditor({ value, onChange, ctx }: PatternEditorProps) {
  const blocks = ctx.registries.entries(PATTERN_REGISTRY)
  const tags = ctx.registries.entries(TAG_REGISTRY)
  const tagOptions = useMemo(() => tags.map((id) => ({ value: id, label: `#${id}` })), [tags])
  const rows = value.entries

  const setRows = (next: readonly PatternEntry[]) => onChange({ ...value, entries: next })
  const replace = (index: number, next: PatternEntry) =>
    setRows(rows.map((row, i) => (i === index ? next : row)))

  // The weight column is only offered once there is something to weight against. With
  // one entry the field would invite a value that WorldEdit refuses to parse.
  const weighted = rows.length > 1
  const total = rows.reduce(
    (sum, row) => sum + (row.weight === '' ? 1 : Math.max(0, row.weight)),
    0,
  )

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const n = index + 1
        const kind = row.kind ?? 'block'
        const share =
          total > 0 ? ((row.weight === '' ? 1 : Math.max(0, row.weight)) / total) * 100 : 0
        return (
          <div key={index} className={ROW_GROUP}>
            <div className="flex items-center gap-1.5">
              {weighted && (
                <input
                  type="number"
                  className={`${FIELD} w-12 px-1.5`}
                  min={0}
                  placeholder="1"
                  value={row.weight}
                  aria-label={`Chance for block ${n}`}
                  onChange={(e) =>
                    replace(index, {
                      ...row,
                      weight: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              )}
              <Listbox
                value={kind}
                options={KINDS}
                aria-label={`Kind of entry ${n}`}
                className="min-w-0 flex-1"
                onChange={(next) =>
                  replace(index, {
                    weight: row.weight,
                    block: '',
                    ...(next === 'block' ? {} : { kind: next }),
                  })
                }
              />
              {weighted && (
                <span className="text-text-secondary text-1xs w-8 text-right tabular-nums">
                  {`${Math.round(share)}%`}
                </span>
              )}
              <IconButton
                title={`Remove entry ${n}`}
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                <Icon name="close" size="sm" />
              </IconButton>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                {kind === 'block' || kind === 'apply' ? (
                  <RegistryPicker
                    value={row.block}
                    entries={blocks}
                    ariaLabel={kind === 'apply' ? `Type for entry ${n}` : `Block ${n}`}
                    invalid={!isKnownBlock(row.block, ctx)}
                    onChange={(next) =>
                      replace(
                        index,
                        kind === 'apply'
                          ? { ...row, block: next }
                          : { weight: row.weight, block: next },
                      )
                    }
                  />
                ) : kind === 'tag' ? (
                  <Combobox
                    value={row.block}
                    options={tagOptions}
                    aria-label={`Tag for entry ${n}`}
                    invalid={row.block !== '' && !ctx.registries.has(TAG_REGISTRY, row.block)}
                    onChange={(next) => replace(index, { ...row, block: next.replace(/^#+/, '') })}
                  />
                ) : (
                  <Offset row={row} n={n} onChange={(next) => replace(index, next)} />
                )}
              </div>
              {kind === 'tag' && (
                <button
                  type="button"
                  aria-pressed={row.anyState === true}
                  onClick={() => replace(index, { ...row, anyState: !row.anyState })}
                  className={
                    `${FOCUS} border-hairline duration-fast min-h-8 shrink-0 rounded-md px-2 text-xs whitespace-nowrap transition-colors motion-reduce:transition-none ` +
                    (row.anyState
                      ? 'border-accent bg-accent/13 text-accent'
                      : 'border-border-hover text-text-secondary hover:text-text-primary')
                  }
                >
                  Any state
                </button>
              )}
            </div>
            {kind === 'block' && (
              <Properties row={row} n={n} ctx={ctx} onChange={(next) => replace(index, next)} />
            )}
            {kind === 'apply' && (
              <ChipField
                values={Object.entries(row.states ?? {}).map(([k, v]) => `${k}=${v}`)}
                onChange={(list) => {
                  const pairs = list
                    .map((pair) => pair.split('='))
                    .filter((pair): pair is [string, string] => pair.length === 2)
                  const states = Object.fromEntries(pairs)
                  const { states: _states, ...rest } = row
                  replace(index, Object.keys(states).length > 0 ? { ...rest, states } : rest)
                }}
                options={[]}
                ariaLabel={`States for entry ${n}`}
                placeholder="name=value"
              />
            )}
          </div>
        )
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={ROW_ADD}
          onClick={() => setRows([...rows, { block: '', weight: '' }])}
        >
          + block
        </button>
        {weighted && <span className="text-text-muted text-1xs">chances are relative</span>}
      </div>
    </div>
  )
}

/** A block's properties, each at its default, set, or random. */
function Properties({
  row,
  n,
  ctx,
  onChange,
}: {
  row: PatternEntry
  n: number
  ctx: SerializeContext
  onChange: (next: PatternEntry) => void
}) {
  const known = row.block.trim() === '' ? undefined : ctx.registries.blockStates?.(row.block)
  if (known === undefined || Object.keys(known.properties).length === 0) return null
  const states = row.states ?? {}
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Object.entries(known.properties).map(([key, values]) => {
        const current = states[key] ?? (row.random ? RANDOM : DEFAULT)
        const options: ListOption[] = [
          { value: DEFAULT, label: known.defaults[key] ?? 'default' },
          { value: RANDOM, label: 'random' },
          ...values.filter((v) => v !== known.defaults[key]).map((v) => ({ value: v, label: v })),
        ]
        return (
          <div key={key} className="flex min-w-0 flex-col gap-0.5">
            <span className={SUB_LABEL}>{key}</span>
            <Listbox
              value={current === known.defaults[key] ? DEFAULT : current}
              options={options}
              aria-label={`${key} for entry ${n}`}
              onChange={(choice) => onChange(withProperty(row, known, key, choice))}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Where the clipboard's tiling starts, one field per axis. */
function Offset({
  row,
  n,
  onChange,
}: {
  row: PatternEntry
  n: number
  onChange: (next: PatternEntry) => void
}) {
  const offset = row.offset ?? [0, 0, 0]
  return (
    <div className="flex gap-1.5">
      {(['x', 'y', 'z'] as const).map((axis, i) => (
        <label key={axis} className="flex min-w-0 flex-1 items-center gap-1">
          <span className={SUB_LABEL}>{axis}</span>
          <input
            type="number"
            step={1}
            className={`${FIELD} w-full`}
            value={offset[i]}
            aria-label={`Clipboard offset ${axis} for entry ${n}`}
            onChange={(e) => {
              const next = [...offset] as [number, number, number]
              next[i] = Math.trunc(Number(e.target.value) || 0)
              const { offset: _offset, ...rest } = row
              onChange(next.some((v) => v !== 0) ? { ...rest, offset: next } : rest)
            }}
          />
        </label>
      ))}
    </div>
  )
}
