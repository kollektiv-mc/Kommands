import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A short label beside a control, on hover and on keyboard focus.
 *
 * Instead of the native `title`, which the WebView draws in the platform's own style
 * and delay, over the dark UI and out of step with everything else. The control keeps
 * its own accessible name (`aria-label`); this only draws it, so it is hidden from the
 * accessibility tree rather than announced a second time.
 *
 * Portalled and placed `fixed` from the wrapper's box, above it, or below when there is
 * no room above, and held inside the window's sides. It fades in only, like the
 * popovers, and not at all under reduced motion.
 */
const DELAY_MS = 450

export function Tooltip({
  label,
  children,
  side = 'top',
  className = '',
}: {
  label: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef(0)

  const show = (now: boolean) => {
    window.clearTimeout(timer.current)
    if (now) setOpen(true)
    else timer.current = window.setTimeout(() => setOpen(true), DELAY_MS)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <span
      ref={anchor}
      className={`inline-flex ${className}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(false)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => e.target.matches(':focus-visible') && show(true)}
      onBlur={hide}
    >
      {children}
      {open && label !== '' && <Tip anchor={anchor} side={side} label={label} />}
    </span>
  )
}

function Tip({
  anchor,
  side,
  label,
}: {
  anchor: React.RefObject<HTMLSpanElement | null>
  side: 'top' | 'bottom'
  label: ReactNode
}) {
  const tip = useRef<HTMLDivElement>(null)

  // Written onto the element: a position is not state, and it is known only after layout.
  useLayoutEffect(() => {
    const el = tip.current
    const box = anchor.current?.getBoundingClientRect()
    if (!el || !box) return
    const gap = parseFloat(getComputedStyle(el).getPropertyValue('--popover-gap')) || 0
    const up = side === 'top' ? box.top > el.offsetHeight + gap * 2 : false
    const top = up ? box.top - el.offsetHeight - gap : box.bottom + gap
    const width = document.documentElement.clientWidth
    const left = Math.min(
      Math.max(gap, box.left + box.width / 2 - el.offsetWidth / 2),
      width - el.offsetWidth - gap,
    )
    el.style.top = `${top}px`
    el.style.left = `${left}px`
  }, [anchor, side])

  return createPortal(
    <div
      ref={tip}
      aria-hidden="true"
      className="popover tooltip-enter border-hairline border-border-hover bg-overlay text-text-secondary text-1xs pointer-events-none fixed z-60 max-w-60 rounded-lg px-2.5 py-1.5 font-medium"
    >
      {label}
    </div>,
    document.getElementById('root') ?? document.body,
  )
}
