import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { AXIS_TONE, decimals, formatNumber, useScrub } from './scrub'
import { NUM } from './styles'

/**
 * A number in the inspector, with a label that scrubs.
 *
 * Dragging the label (or the axis letter inside the field) sideways changes the value by
 * one step every few pixels, the way a 3D tool's fields work. While the field has focus
 * it shows what is typed, so a half-typed `0.` is not reformatted under the caret.
 */

export function NumberField({
  label,
  axis,
  value,
  step,
  onChange,
  onDone = () => {},
  min,
  max,
}: {
  /** The accessible name. */
  label: string
  /** Drawn inside the field, in the axis colour. */
  axis?: 'x' | 'y' | 'z'
  value: number
  step: number
  onChange: (value: number) => void
  onDone?: () => void
  min?: number
  max?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  const set = (v: number) => onChange(clamp(v))
  const scrub = useScrub(value, step, set, onDone)

  return (
    <div className={NUM}>
      {axis !== undefined && (
        <span
          aria-hidden="true"
          onPointerDown={scrub}
          className={`${AXIS_TONE[axis]} text-2xs w-3.5 shrink-0 cursor-ew-resize text-center font-mono font-semibold select-none`}
        >
          {axis}
        </span>
      )}
      <input
        ref={input}
        aria-label={label}
        inputMode="decimal"
        value={draft ?? formatNumber(value, step)}
        onFocus={(e) => {
          setDraft(e.currentTarget.value)
          e.currentTarget.select()
        }}
        onChange={(e) => {
          setDraft(e.currentTarget.value)
          const v = Number(e.currentTarget.value)
          if (e.currentTarget.value.trim() !== '' && Number.isFinite(v)) set(v)
        }}
        onBlur={() => {
          setDraft(null)
          onDone()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const next = clamp(value + (e.key === 'ArrowUp' ? step : -step))
            set(Number(next.toFixed(decimals(step))))
            setDraft(formatNumber(next, step))
          }
          e.stopPropagation()
        }}
        className={`min-w-0 flex-1 bg-transparent py-0 pr-1.5 font-mono text-xs tabular-nums outline-none ${axis === undefined ? 'pl-2' : 'pl-0.5'}`}
      />
    </div>
  )
}

/** A label and its field, on the inspector's two-column grid. The label scrubs too. */
export function FieldRow({
  label,
  children,
  scrub,
}: {
  label: string
  children: ReactNode
  scrub?: (event: PointerEvent<HTMLElement>) => void
}) {
  return (
    <div className="grid grid-cols-[calc(var(--spacing)*16)_1fr] items-center gap-2">
      <span
        onPointerDown={scrub}
        className={`text-text-secondary text-xs select-none ${scrub ? 'cursor-ew-resize' : ''}`}
      >
        {label}
      </span>
      {children}
    </div>
  )
}
