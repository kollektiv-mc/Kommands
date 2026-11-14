import { useMemo, useState } from 'react'
import type { ListOption } from '../../lib/listbox'
import { Combobox } from '../ui/Combobox'
import { Icon } from '../ui/Icon'

/**
 * A list of ids as chips, and a field that adds to it.
 *
 * The field is a Combobox, so it completes from a registry and still takes free text:
 * an option picked, or Enter on what was typed, becomes a chip and the field empties.
 * Anything already in the list is not offered again.
 */
export function ChipField({
  values,
  onChange,
  options,
  ariaLabel,
  placeholder,
  isKnown = () => true,
  onAdd,
}: {
  values: readonly string[]
  onChange: (next: readonly string[]) => void
  options: readonly ListOption[]
  /** What the list is, e.g. "Include". The field and each remove button are named from it. */
  ariaLabel: string
  placeholder?: string
  /** Whether a chip names something this version has. An unknown one is outlined. */
  isKnown?: (value: string) => boolean
  /** Replaces the default append, for a list with a rule about what may sit together. */
  onAdd?: (value: string, current: readonly string[]) => readonly string[]
}) {
  const [draft, setDraft] = useState('')
  const offered = useMemo(
    () => options.filter((option) => !values.includes(option.value)),
    [options, values],
  )

  const add = (raw: string) => {
    const value = raw.trim()
    setDraft('')
    if (value === '' || values.includes(value)) return
    onChange(onAdd ? onAdd(value, values) : [...values, value])
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {values.length > 0 && (
        <ul aria-label={ariaLabel} className="flex flex-wrap gap-1">
          {values.map((value) => (
            <li
              key={value}
              className={
                'border-hairline bg-canvas text-text-primary flex items-center gap-0.5 rounded-md py-0.5 pr-0.5 pl-1.5 font-mono text-xs ' +
                (isKnown(value) ? 'border-border-hover' : 'border-warning')
              }
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value} from ${ariaLabel}`}
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="text-text-muted hover:text-danger duration-fast rounded-sm p-0.5 transition-colors motion-reduce:transition-none"
              >
                <Icon name="close" size="xs" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Combobox
        value={draft}
        options={offered}
        onChange={setDraft}
        onCommit={add}
        placeholder={placeholder}
        aria-label={`Add to ${ariaLabel}`}
      />
    </div>
  )
}
