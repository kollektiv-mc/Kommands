import { useCallback, useRef } from 'react'

/** Fully shown within NEAR px of its corner, gone by FAR. */
const NEAR = 32
const FAR = 120

/**
 * A control that fades in as the pointer nears one corner of its card: the trash at a
 * saved command's bottom left, the unpin badge at a pinned generator's top right.
 *
 * Returns two callback refs, one for the card and one for the control. The pointer is
 * followed with native listeners and written straight to the control's style, so it
 * re-renders nothing. Keyboard focus shows the control in full (see `REVEALED`).
 */
export function useReveal(corner: 'bottom-left' | 'top-right') {
  const control = useRef<HTMLElement | null>(null)

  const card = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      const show = (opacity: number) => {
        const target = control.current
        if (!target) return
        target.style.opacity = opacity.toFixed(2)
        target.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none'
      }
      const move = (e: MouseEvent) => {
        const box = el.getBoundingClientRect()
        const dx = corner === 'top-right' ? box.right - e.clientX : e.clientX - box.left
        const dy = corner === 'top-right' ? e.clientY - box.top : box.bottom - e.clientY
        show(Math.max(0, Math.min(1, (FAR - Math.hypot(dx, dy)) / (FAR - NEAR))))
      }
      const leave = () => show(0)
      el.addEventListener('mousemove', move)
      el.addEventListener('mouseleave', leave)
      return () => {
        el.removeEventListener('mousemove', move)
        el.removeEventListener('mouseleave', leave)
      }
    },
    [corner],
  )

  const target = useCallback((el: HTMLElement | null) => {
    control.current = el
  }, [])

  return { card, control: target }
}

/** Hidden until revealed, and fully shown while it has keyboard focus. */
export const REVEALED =
  'opacity-0 pointer-events-none focus-visible:opacity-100! focus-visible:pointer-events-auto! transition-opacity'
