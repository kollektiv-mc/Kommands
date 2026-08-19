import type { EditorProps } from '../../schema/types'
import { FIELD } from './fieldStyles'

/** Backs `integer`, `float` and `double`. min/max come from Brigadier properties. */
export function NumberEditor({ value, onChange, options, diagnostics }: EditorProps<number | ''>) {
  const min = typeof options.min === 'number' ? options.min : undefined
  const max = typeof options.max === 'number' ? options.max : undefined
  return (
    <input
      type="number"
      className={FIELD}
      value={value === '' ? '' : String(value)}
      min={min}
      max={max}
      step={options.integral === false ? 'any' : 1}
      aria-invalid={diagnostics.length > 0}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  )
}
