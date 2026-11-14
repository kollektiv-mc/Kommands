import { useId, useMemo } from 'react'
import type { EditorProps } from '../../schema/types'
import {
  BIOME_REGISTRY,
  BLOCK_TAG_REGISTRY,
  NEW_RULE,
  OFFSET_TESTS,
  type MaskRule,
  type MaskTest,
  type MaskValue,
} from '../../schema/argument-types/we-mask'
import { isKnownBlock, PATTERN_REGISTRY } from '../../schema/argument-types/we-pattern'
import type { ListOption } from '../../lib/listbox'
import { Listbox } from '../ui/Listbox'
import { Stepper } from '../ui/Stepper'
import { Combobox } from '../ui/Combobox'
import { ChipField } from './ChipField'
import { FIELD, FOCUS, SUB_LABEL } from './fieldStyles'
import { ROW_ADD, ROW_REMOVE } from './rowStyles'

/** Each test, worded to follow "This block" or "Block above" in its row. */
const TESTS: readonly ListOption<MaskTest>[] = [
  { value: 'blocks', label: 'is any of' },
  { value: 'tag', label: 'is in tag' },
  { value: 'air', label: 'is air' },
  { value: 'existing', label: 'is any block' },
  { value: 'solid', label: 'is solid' },
  { value: 'surface', label: 'touches air' },
  { value: 'states', label: 'has states' },
  { value: 'biome', label: 'is in biome' },
  { value: 'selection', label: 'is in the selection' },
  { value: 'chance', label: 'passes a chance of' },
  { value: 'expression', label: 'matches the formula' },
]

type Where = 'here' | 'above' | 'below'
const WHERE: readonly ListOption<Where>[] = [
  { value: 'here', label: 'This block' },
  { value: 'above', label: 'Block above' },
  { value: 'below', label: 'Block below' },
]
const whereOf = (offset: number): Where => (offset > 0 ? 'above' : offset < 0 ? 'below' : 'here')

/**
 * Backs `we_mask`: which blocks an edit may touch.
 *
 * Leads with the three things nearly every mask is: blocks to include, blocks to leave
 * out, and a chance. Everything else the grammar can say is a rule below them, one
 * sentence each ("Block below is in tag logs"), and every rule must hold. That is the
 * grammar's own shape: masks side by side all have to match, and there is no "or"
 * between them, so the editor offers none.
 */
export function MaskEditor({ value, onChange, ctx, options }: EditorProps<MaskValue>) {
  const blocks = ctx.registries.entries(PATTERN_REGISTRY)
  const tags = ctx.registries.entries(BLOCK_TAG_REGISTRY)
  const biomes = ctx.registries.entries(BIOME_REGISTRY)
  const blockOptions = useMemo(() => blocks.map((id) => ({ value: id, label: id })), [blocks])
  const biomeOptions = useMemo(() => biomes.map((id) => ({ value: id, label: id })), [biomes])
  const tagOptions = useMemo(() => tags.map((id) => ({ value: id, label: `#${id}` })), [tags])
  const listOptions = useMemo(
    () => [...tagOptions.map((o) => ({ ...o, value: `#${o.value}` })), ...blockOptions],
    [tagOptions, blockOptions],
  )
  const known = (entry: string) =>
    entry.startsWith('#')
      ? ctx.registries.has(BLOCK_TAG_REGISTRY, entry.replace(/^#+/, ''))
      : isKnownBlock(entry, ctx)

  const set = (patch: Partial<MaskValue>) => onChange({ ...value, ...patch })
  const setRule = (index: number, patch: Partial<MaskRule>) =>
    set({ rules: value.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) })

  const ids = useId()
  const chanceId = `${ids}-chance`

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={SUB_LABEL}>Include</span>
          <ChipField
            values={value.include}
            onChange={(include) => set({ include })}
            options={listOptions}
            ariaLabel="Include"
            placeholder={options.default === undefined ? 'any block' : 'any block but air'}
            isKnown={known}
            // A tag and a list of blocks cannot be one mask, so either replaces the other.
            onAdd={(added, current) =>
              added.startsWith('#') || current.some((entry) => entry.startsWith('#'))
                ? [added]
                : [...current, added]
            }
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={SUB_LABEL}>Exclude</span>
          <ChipField
            values={value.exclude}
            onChange={(exclude) => set({ exclude })}
            options={listOptions}
            ariaLabel="Exclude"
            placeholder="nothing"
            isKnown={known}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={chanceId} className={SUB_LABEL}>
            Chance %
          </label>
          <Stepper
            id={chanceId}
            value={value.chance}
            onChange={(chance) => set({ chance })}
            min={1}
            max={100}
            placeholder="100"
          />
        </div>
      </div>

      {value.rules.length > 0 && (
        <ol aria-label="Rules" className="flex flex-col gap-1.5">
          {value.rules.map((rule, index) => (
            <li key={index} className="flex flex-col gap-1.5">
              {index > 0 && <span className={`${SUB_LABEL} pl-1`}>and</span>}
              <RuleRow
                rule={rule}
                index={index}
                onChange={(patch) => setRule(index, patch)}
                onRemove={() => set({ rules: value.rules.filter((_, i) => i !== index) })}
                blockOptions={blockOptions}
                tagOptions={tagOptions}
                biomeOptions={biomeOptions}
                isKnownBlock={(id) => isKnownBlock(id, ctx)}
              />
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        className={ROW_ADD}
        onClick={() => set({ rules: [...value.rules, NEW_RULE] })}
      >
        + rule
      </button>
    </div>
  )
}

function RuleRow({
  rule,
  index,
  onChange,
  onRemove,
  blockOptions,
  tagOptions,
  biomeOptions,
  isKnownBlock: knownBlock,
}: {
  rule: MaskRule
  index: number
  onChange: (patch: Partial<MaskRule>) => void
  onRemove: () => void
  blockOptions: readonly ListOption[]
  tagOptions: readonly ListOption[]
  biomeOptions: readonly ListOption[]
  isKnownBlock: (id: string) => boolean
}) {
  const n = index + 1
  const where = whereOf(rule.offset)
  const movable = OFFSET_TESTS.has(rule.test)

  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {movable ? (
        <Listbox
          value={where}
          options={WHERE}
          aria-label={`Rule ${n}: which block`}
          className="w-32"
          onChange={(next) =>
            onChange({
              offset:
                next === 'here' ? 0 : (next === 'above' ? 1 : -1) * Math.abs(rule.offset || 1),
            })
          }
        />
      ) : (
        <span className="text-text-secondary self-center px-1 text-xs">This block</span>
      )}
      {movable && where !== 'here' && (
        <div className="w-32 shrink-0">
          <Stepper
            value={Math.abs(rule.offset)}
            onChange={(steps) =>
              onChange({ offset: Math.sign(rule.offset) * Math.max(1, steps === '' ? 1 : steps) })
            }
            min={1}
            max={8}
            aria-label={`Rule ${n}: blocks away`}
          />
        </div>
      )}
      <button
        type="button"
        aria-pressed={rule.not}
        onClick={() => onChange({ not: !rule.not })}
        className={
          `${FOCUS} border-hairline duration-fast min-h-8 rounded-md px-2 text-xs transition-colors motion-reduce:transition-none ` +
          (rule.not
            ? 'border-accent bg-accent/13 text-accent'
            : 'border-border-hover text-text-secondary hover:text-text-primary')
        }
      >
        not
      </button>
      <Listbox
        value={rule.test}
        options={TESTS}
        aria-label={`Rule ${n}: test`}
        className="w-44"
        onChange={(test) => onChange({ test, values: [], text: '' })}
      />
      <div className="min-w-40 flex-1">
        <RuleValue
          rule={rule}
          n={n}
          onChange={onChange}
          blockOptions={blockOptions}
          tagOptions={tagOptions}
          biomeOptions={biomeOptions}
          isKnownBlock={knownBlock}
        />
      </div>
      <button
        type="button"
        className={`${ROW_REMOVE} min-h-8`}
        aria-label={`Remove rule ${n}`}
        onClick={onRemove}
      >
        − remove
      </button>
    </div>
  )
}

function RuleValue({
  rule,
  n,
  onChange,
  blockOptions,
  tagOptions,
  biomeOptions,
  isKnownBlock: knownBlock,
}: {
  rule: MaskRule
  n: number
  onChange: (patch: Partial<MaskRule>) => void
  blockOptions: readonly ListOption[]
  tagOptions: readonly ListOption[]
  biomeOptions: readonly ListOption[]
  isKnownBlock: (id: string) => boolean
}) {
  switch (rule.test) {
    case 'blocks':
      return (
        <ChipField
          values={rule.values}
          onChange={(values) => onChange({ values })}
          options={blockOptions}
          ariaLabel={`Rule ${n} blocks`}
          isKnown={knownBlock}
        />
      )
    case 'biome':
      return (
        <ChipField
          values={rule.values}
          onChange={(values) => onChange({ values })}
          options={biomeOptions}
          ariaLabel={`Rule ${n} biomes`}
        />
      )
    case 'states':
      return (
        <div className="flex flex-wrap items-start gap-1.5">
          <div className="min-w-40 flex-1">
            <ChipField
              values={rule.values}
              onChange={(values) => onChange({ values })}
              options={[]}
              ariaLabel={`Rule ${n} states`}
              placeholder="name=value"
            />
          </div>
          <button
            type="button"
            aria-pressed={rule.exact}
            onClick={() => onChange({ exact: !rule.exact })}
            className={
              `${FOCUS} border-hairline duration-fast min-h-8 rounded-md px-2 text-xs transition-colors motion-reduce:transition-none ` +
              (rule.exact
                ? 'border-accent bg-accent/13 text-accent'
                : 'border-border-hover text-text-secondary hover:text-text-primary')
            }
          >
            Exact
          </button>
        </div>
      )
    case 'tag':
      return (
        <Combobox
          value={rule.text}
          options={tagOptions.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(text) => onChange({ text: text.replace(/^#+/, '') })}
          aria-label={`Rule ${n} tag`}
          placeholder="tag"
        />
      )
    case 'chance':
      return (
        <Stepper
          value={rule.chance}
          onChange={(chance) => onChange({ chance: chance === '' ? 50 : chance })}
          min={1}
          max={100}
          aria-label={`Rule ${n} chance %`}
        />
      )
    case 'expression':
      return (
        <input
          type="text"
          spellCheck={false}
          value={rule.text}
          placeholder="y<64"
          aria-label={`Rule ${n} formula`}
          onChange={(event) => onChange({ text: event.target.value })}
          className={`${FIELD} w-full`}
        />
      )
    default:
      return null
  }
}
