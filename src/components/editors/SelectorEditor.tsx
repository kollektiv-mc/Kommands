import { useMemo } from 'react'
import type { EditorProps } from '../../schema/types'
import { selectorsFor } from '../../data/authored/selectors'
import { defaultText } from '../../schema/default-text'
import { Combobox } from '../ui/Combobox'

/**
 * Backs `entity_selector`.
 *
 * The shorthands offered narrow by the Brigadier `type` and `amount` properties, and
 * come from src/data/authored/selectors.ts — they are game values, so they are data
 * rather than literals written here. A full selector builder (@e[type=…,distance=…])
 * is later work; free text is accepted meanwhile so nothing is unreachable.
 *
 * Each suggestion carries what it selects as its description, which a datalist could
 * only show in its platform popup and which read into the field's accessible name when
 * written as option text. The list now names an option by its token and describes it
 * separately.
 */
export function SelectorEditor({
  id,
  describedBy,
  value,
  onChange,
  options,
  diagnostics,
}: EditorProps<string>) {
  const suggestions = useMemo(
    () =>
      selectorsFor(options).map((s) => ({ value: s.token, label: s.token, description: s.label })),
    [options],
  )
  return (
    <Combobox
      id={id}
      aria-describedby={describedBy}
      value={value}
      options={suggestions}
      onChange={onChange}
      placeholder={defaultText(options)}
      invalid={diagnostics.length > 0}
    />
  )
}
