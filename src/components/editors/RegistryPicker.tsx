import { useMemo } from 'react'
import { Combobox } from '../ui/Combobox'

/**
 * A text field completed from one of the version's registries.
 *
 * Free text is still accepted. The registries are large and the ids are long, so an
 * input that refused anything it did not recognise would be unusable while typing —
 * and existence is a validator's job, which warns rather than blocks.
 *
 * Suggestions are filtered and capped by the Combobox rather than all rendered. The
 * item registry alone holds 1333 entries, and putting that many options in the
 * document on every keystroke is felt immediately. The cap and the count of matches
 * live in the list's footer, where they no longer push the row below down.
 */
interface RegistryPickerProps {
  id?: string
  describedBy?: string
  value: string
  onChange: (next: string) => void
  /** Candidate ids, from ctx.registries.entries(...). */
  entries: readonly string[]
  ariaLabel: string
  invalid?: boolean
}

export function RegistryPicker({
  id,
  describedBy,
  value,
  onChange,
  entries,
  ariaLabel,
  invalid,
}: RegistryPickerProps) {
  const options = useMemo(() => entries.map((entry) => ({ value: entry, label: entry })), [entries])
  return (
    <Combobox
      id={id}
      aria-describedby={describedBy}
      value={value}
      options={options}
      onChange={onChange}
      aria-label={ariaLabel}
      invalid={invalid}
    />
  )
}
