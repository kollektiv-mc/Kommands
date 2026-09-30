/**
 * An on/off switch: a native checkbox with `role="switch"`, drawn by `.switch` in
 * `styles/index.css` to docs/design-tokens.md's toggle pattern (a 20 by 36 pill, a
 * 16px knob, accent when on, `--border-hover` when off).
 *
 * The checkbox stays a checkbox underneath, so Space toggles it, a wrapping label
 * clicks it, and a form or test that reads `checked` keeps working.
 */
export function Switch({
  id,
  checked,
  onChange,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label'?: string
  'aria-describedby'?: string
}) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      // Mirrors `checked`. A switch role takes its state from aria-checked, and the
      // native checked state is not guaranteed to be mapped onto it.
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="switch"
    />
  )
}
