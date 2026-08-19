import type { EditorProps } from '../../schema/types'
import { FIELD } from './fieldStyles'

/**
 * Backs `string` and the `raw_text` fallback.
 *
 * raw_text is what a deep parser binds to before its editor exists. That is the
 * documented degradation: a command becomes a text field rather than breaking the
 * build. It is deliberately not distinguishable from `string` here — the difference
 * is recorded in the parser table, not in the UI.
 */
export function TextEditor({ value, onChange, options, diagnostics }: EditorProps<string>) {
  return (
    <input
      type="text"
      className={FIELD}
      value={value}
      placeholder={typeof options.placeholder === 'string' ? options.placeholder : undefined}
      aria-invalid={diagnostics.length > 0}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
