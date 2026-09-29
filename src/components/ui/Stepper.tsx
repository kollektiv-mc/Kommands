import { Icon } from './Icon'

/**
 * A number field with a step down and a step up on either side of it.
 *
 * The field is a native `type="number"`, so the keyboard already steps it with the
 * arrows and a screen reader already announces a spin button; the two buttons are for
 * the pointer and are left out of the tab order. `''` is a value like any other: an
 * optional number that was never given, which the buttons step from `min` rather than
 * from zero.
 */
export function Stepper({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  invalid,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: {
  id?: string
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
  max?: number
  /** A number, or 'any' for a field that takes fractions and steps by one. */
  step?: number | 'any'
  placeholder?: string
  invalid?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
}) {
  const by = step === 'any' ? 1 : step
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
  const bump = (direction: 1 | -1) => {
    const from = value === '' ? (min ?? 0) - (direction > 0 ? by : -by) : value
    onChange(clamp(from + direction * by))
  }
  const button =
    'text-text-muted hover:text-text-primary hover:bg-hover flex w-7 items-center justify-center transition-colors duration-fast motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="border-hairline border-border-hover bg-canvas hover:border-text-faint focus-within:border-accent duration-fast inline-flex h-8 items-stretch overflow-hidden rounded-md transition-colors motion-reduce:transition-none">
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel ?? 'Value'}: step down`}
        disabled={value !== '' && min !== undefined && value <= min}
        onClick={() => bump(-1)}
        className={button}
      >
        <Icon name="minus" size="sm" />
      </button>
      <input
        id={id}
        type="number"
        value={value === '' ? '' : String(value)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        className="text-text-primary w-16 [appearance:textfield] bg-transparent text-center font-mono text-xs tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel ?? 'Value'}: step up`}
        disabled={value !== '' && max !== undefined && value >= max}
        onClick={() => bump(1)}
        className={button}
      >
        <Icon name="plus" size="sm" />
      </button>
    </div>
  )
}
