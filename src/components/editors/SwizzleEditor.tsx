import type { EditorProps } from '../../schema/types'
import { FOCUS } from './fieldStyles'

const AXES = ['x', 'y', 'z'] as const

/**
 * Backs `swizzle`, `/execute align`'s axes: any of x, y and z, each at most once.
 *
 * Three toggles rather than a text field, because the only mistakes a text field
 * allows here (a repeat, a `w`) are ones the toggles cannot make. Stored in x, y, z
 * order whatever order they were pressed in; the game accepts any order.
 */
export function SwizzleEditor({ value, onChange, describedBy }: EditorProps<string>) {
  const toggle = (axis: string) =>
    onChange(AXES.filter((a) => (a === axis ? !value.includes(a) : value.includes(a))).join(''))
  return (
    <div className="flex gap-1.5">
      {AXES.map((axis) => (
        <button
          key={axis}
          type="button"
          aria-pressed={value.includes(axis)}
          aria-describedby={describedBy}
          onClick={() => toggle(axis)}
          className={`${FOCUS} border-hairline border-border-hover text-text-secondary hover:text-text-primary aria-pressed:border-accent aria-pressed:bg-accent/15 aria-pressed:text-accent duration-fast h-8 w-10 rounded-md font-mono text-xs transition-colors motion-reduce:transition-none`}
        >
          {axis}
        </button>
      ))}
    </div>
  )
}
