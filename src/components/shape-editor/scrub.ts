import type { PointerEvent } from 'react'

/** How a dragged label turns into a value: one step every few pixels sideways. */
const PX_PER_STEP = 3

// z has no colour token yet; see docs/health-checklist.md, Open backlog.
export const AXIS_TONE = { x: 'text-danger', y: 'text-success', z: 'text-text-secondary' } as const

export function decimals(step: number): number {
  if (step >= 1) return 0
  return step >= 0.01 ? 2 : 3
}

export function formatNumber(value: number, step: number): string {
  const fixed = value.toFixed(decimals(step))
  return String(Number(fixed))
}

export function useScrub(
  value: number,
  step: number,
  onChange: (value: number) => void,
  onDone: () => void,
) {
  return (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const el = event.currentTarget
    el.setPointerCapture(event.pointerId)
    const x0 = event.clientX
    const move = (m: globalThis.PointerEvent) => {
      const next = value + Math.round((m.clientX - x0) / PX_PER_STEP) * step
      onChange(Number(next.toFixed(decimals(step))))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      onDone()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
}
