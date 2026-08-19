import { useId, useMemo } from 'react'
import { FIELD } from './fieldStyles'

/**
 * A text field completed from one of the version's registries.
 *
 * Free text is still accepted. The registries are large and the ids are long, so an
 * input that refused anything it did not recognise would be unusable while typing —
 * and existence is a validator's job, which warns rather than blocks.
 *
 * Options are filtered and capped rather than all rendered. The item registry alone
 * holds 1333 entries, and putting that many option nodes in the document on every
 * keystroke is felt immediately.
 */
const LIMIT = 50

interface RegistryPickerProps {
  value: string
  onChange: (next: string) => void
  /** Candidate ids, from ctx.registries.entries(...). */
  entries: readonly string[]
  ariaLabel: string
  invalid?: boolean
}

export function RegistryPicker({
  value,
  onChange,
  entries,
  ariaLabel,
  invalid,
}: RegistryPickerProps) {
  const listId = useId()
  const { shown, total } = useMemo(() => {
    const query = value.trim().toLowerCase()
    const hits = query === '' ? entries : entries.filter((entry) => entry.includes(query))
    return { shown: hits.slice(0, LIMIT), total: hits.length }
  }, [entries, value])

  return (
    <span className="flex flex-col gap-1">
      <input
        type="text"
        className={FIELD}
        value={value}
        list={listId}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {shown.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      {total > LIMIT && (
        <span className="text-text-faint text-3xs">{`showing ${LIMIT} of ${total}`}</span>
      )}
    </span>
  )
}
