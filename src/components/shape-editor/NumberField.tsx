import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { moveLadder, RUNGS, startLadder, type Ladder } from './ladder'
import { AXIS_TONE, decimals, formatNumber, useScrub } from './scrub'
import { NUM } from './styles'

/**
 * A number in the inspector, with a label that scrubs.
 *
 * Dragging the label (or the axis letter inside the field) sideways changes the value by
 * one step every few pixels, the way a 3D tool's fields work. While the field has focus
 * it shows what is typed, so a half-typed `0.` is not reformatted under the caret.
 * A middle drag anywhere on it opens the value ladder (`ladder.ts`); Escape during one
 * puts the value back.
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
  const ladder = useLadder(value, step, set, onDone)

  return (
    // aislop-ignore-next-line jsx-a11y/no-static-element-interactions -- the ladder is a middle-drag gesture over the whole field; the input inside stays its keyboard interface
    <div
      className={`${NUM} ${ladder.state ? 'cursor-ew-resize' : ''}`}
      onPointerDown={ladder.start}
      onMouseDown={keepMiddle}
      onAuxClick={keepMiddle}
    >
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
        className={`min-w-0 flex-1 bg-transparent py-0 pr-1.5 font-mono text-xs tabular-nums outline-none ${axis === undefined ? 'pl-2' : 'pl-0.5'} ${ladder.state ? 'cursor-ew-resize' : ''}`}
      />
      {ladder.state && <LadderPanel ladder={ladder.state} at={ladder.at} />}
    </div>
  )
}

/** A middle press on a field neither scrolls the page nor pastes into it. */
function keepMiddle(event: MouseEvent) {
  if (event.button === 1) event.preventDefault()
}

/**
 * The ladder's drag, from a middle press on the field to its release. The value
 * changes as it goes and settles as one step on release; Escape or a cancelled
 * pointer puts back the value it started from.
 */
function useLadder(
  value: number,
  step: number,
  onChange: (value: number) => void,
  onDone: () => void,
) {
  const [state, setState] = useState<Ladder | null>(null)
  const [at, setAt] = useState({ x: 0, y: 0 })
  const start = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    const pointer = event.pointerId
    const original = value
    let l = startLadder(value, step, event.clientX, event.clientY)
    setAt({ x: event.clientX, y: event.clientY })
    setState(l)
    const move = (m: globalThis.PointerEvent) => {
      if (m.pointerId !== pointer) return
      const next = moveLadder(l, m.clientX, m.clientY)
      if (next.value !== l.value) onChange(next.value)
      l = next
      setState(next)
    }
    const end = (revert: boolean) => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('keydown', key, true)
      if (revert) onChange(original)
      setState(null)
      onDone()
    }
    const up = (u: globalThis.PointerEvent) => {
      if (u.pointerId === pointer) end(false)
    }
    const cancel = () => end(true)
    const key = (k: KeyboardEvent) => {
      if (k.key !== 'Escape') return
      k.preventDefault()
      k.stopImmediatePropagation()
      end(true)
    }
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('keydown', key, true)
  }
  return { state, at, start }
}

/**
 * The ladder: one row per step, the one in use lit with the value. Placed once, with
 * the starting row under the pointer, so moving down a row's height takes the next.
 */
function LadderPanel({ ladder, at }: { ladder: Ladder; at: { x: number; y: number } }) {
  const panel = useRef<HTMLDivElement>(null)
  const first = useRef(ladder.first)
  useLayoutEffect(() => {
    const el = panel.current
    const row = el?.children[first.current] as HTMLElement | undefined
    if (!el || !row) return
    const edge = parseFloat(getComputedStyle(el).getPropertyValue('--popover-gap')) * 2 || 0
    const left = at.x - el.offsetWidth / 2
    el.style.left = `${Math.max(edge, Math.min(left, window.innerWidth - el.offsetWidth - edge))}px`
    el.style.top = `${at.y - row.offsetTop - row.offsetHeight / 2}px`
  }, [at])
  return createPortal(
    <div
      ref={panel}
      role="presentation"
      className="popover border-hairline border-border-hover bg-overlay pointer-events-none fixed z-70 w-33 rounded-lg p-1"
    >
      {RUNGS.map((rung, i) => (
        <div
          key={rung}
          data-on={i === ladder.rung || undefined}
          className="text-text-muted data-on:bg-accent/15 data-on:text-accent flex h-7 items-center justify-between rounded-md px-2 font-mono text-xs"
        >
          <span>{rung}</span>
          {i === ladder.rung && <output className="text-text-primary">{ladder.value}</output>}
        </div>
      ))}
    </div>,
    document.getElementById('root') ?? document.body,
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
