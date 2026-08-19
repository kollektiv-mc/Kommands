import type { EditorProps } from '../../schema/types'

/** Backs `bool`. A checkbox rather than the design's pill toggle for now. */
export function ToggleEditor({ value, onChange }: EditorProps<boolean>) {
  return (
    <input
      type="checkbox"
      className="accent-accent"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}
