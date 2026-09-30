import { useId, useLayoutEffect, useRef } from 'react'
import type { ListOption } from '../../lib/listbox'

/**
 * A few short choices shown side by side, with a thumb that slides to the one chosen.
 *
 * Built on native radio inputs, visually hidden behind their labels, rather than on
 * buttons with ARIA roles. The browser then supplies the radio group's semantics, its
 * arrow keys and its single tab stop, which is exactly what Konnekt's button-based
 * Segmented lacks.
 *
 * Every segment is the same width, so the thumb's position is one index and one count
 * written as custom properties. `.segmented-thumb` in `styles/index.css` turns them
 * into a transform, which is the only motion here, and off under reduced motion.
 */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  name,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
}: {
  value: V | ''
  options: readonly ListOption<V>[]
  onChange: (value: V) => void
  /** The radio group's name. Generated when absent; only a form would need a stable one. */
  name?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  const generated = useId()
  const group = name ?? generated
  const track = useRef<HTMLDivElement>(null)
  const index = options.findIndex((o) => o.value === value)

  // Written straight onto the element: two numbers a stylesheet reads, not state.
  useLayoutEffect(() => {
    track.current?.style.setProperty('--seg-count', String(options.length))
    track.current?.style.setProperty('--seg-index', String(Math.max(index, 0)))
  }, [options.length, index])

  return (
    <div
      ref={track}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      className={`segmented border-hairline border-border-hover bg-surface relative inline-grid auto-cols-fr grid-flow-col rounded-lg p-0.5 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`segmented-thumb border-hairline bg-accent/15 border-accent/40 pointer-events-none absolute inset-y-0.5 left-0.5 ${index < 0 ? 'opacity-0' : ''}`}
      />
      {options.map((option) => (
        <label key={option.value} className="relative flex cursor-pointer">
          <input
            type="radio"
            name={group}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={
              'text-text-secondary hover:text-text-primary peer-checked:text-accent peer-focus-visible:outline-accent duration-fast w-full rounded-md px-3 py-1 text-center text-xs font-medium whitespace-nowrap transition-colors peer-focus-visible:outline-1 motion-reduce:transition-none'
            }
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
