import type { EditorProps } from '../../schema/types'
import { defaultText } from '../../schema/default-text'
import { Stepper } from '../ui/Stepper'

/** Backs `integer`, `float` and `double`. min/max come from Brigadier properties. */
export function NumberEditor({
  id,
  describedBy,
  value,
  onChange,
  options,
  diagnostics,
}: EditorProps<number | ''>) {
  return (
    <Stepper
      id={id}
      aria-describedby={describedBy}
      value={value}
      onChange={onChange}
      min={typeof options.min === 'number' ? options.min : undefined}
      max={typeof options.max === 'number' ? options.max : undefined}
      step={options.integral === false ? 'any' : 1}
      placeholder={defaultText(options)}
      invalid={diagnostics.length > 0}
    />
  )
}
