import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * The floating panel under a listbox, a combobox or a menu.
 *
 * `bg-overlay` with a hairline and no shadow, which is what `design/README.md` in
 * kollektiv names as the surface of a floating layer: the translucent `bg-elevated`
 * would let the form show through a list, and the suite draws depth with borders
 * rather than drop shadows.
 *
 * Mounted only while open. A panel that stayed mounted and faded out would keep its
 * options in the accessibility tree and in every `getByRole` query while invisible, and
 * the fade-out costs more than it reads. It animates in only (`.popover-enter` in
 * `styles/index.css`, off under reduced motion).
 *
 * Portalled to the app root and placed `fixed` from the trigger's box, so it opens over
 * the tile and the sheet it sits in rather than being clipped by them: a tile hides
 * what overflows it, and the sheet's body scrolls. Being outside them, it follows the
 * trigger by being placed again on every scroll and resize, which is what Konnekt's
 * portalled quick-add menu lacks (its issue 139). When there is less room below the
 * trigger than above, it opens upward instead.
 */
export function Popover({
  container,
  onDismiss,
  align = 'start',
  className = '',
  children,
}: {
  /** The wrapper around the trigger: what the panel lines up with and opens beside. */
  container: RefObject<HTMLElement | null>
  onDismiss: () => void
  /** Which edge of the trigger it lines up with. `end` for a control at the right edge. */
  align?: 'start' | 'end'
  className?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  // Placement is written straight onto the element rather than through state: it
  // changes on every scroll, and a state update there would render the list each time.
  useLayoutEffect(() => {
    const el = panel.current
    const anchor = container.current
    if (!el || !anchor) return
    const gap = parseFloat(getComputedStyle(el).getPropertyValue('--popover-gap')) || 0
    let frame = 0
    const place = () => {
      frame = 0
      const box = anchor.getBoundingClientRect()
      const below = window.innerHeight - box.bottom
      const above = box.top
      const up = below < el.offsetHeight + gap * 2 && above > below
      el.dataset.side = up ? 'top' : 'bottom'
      el.style.minWidth = `${box.width}px`
      el.style.top = up ? '' : `${box.bottom + gap}px`
      el.style.bottom = up ? `${window.innerHeight - box.top + gap}px` : ''
      el.style.left = align === 'start' ? `${box.left}px` : ''
      el.style.right =
        align === 'end' ? `${document.documentElement.clientWidth - box.right}px` : ''
    }
    const later = () => {
      if (frame === 0) frame = requestAnimationFrame(place)
    }
    place()
    // Capture, since a scroll does not bubble and any container around the trigger may scroll.
    window.addEventListener('scroll', later, { capture: true, passive: true })
    window.addEventListener('resize', later)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', later, { capture: true })
      window.removeEventListener('resize', later)
    }
  }, [container, align])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (container.current?.contains(target) || panel.current?.contains(target)) return
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [container, onDismiss])

  return createPortal(
    <div
      ref={panel}
      data-side="bottom"
      className={`popover popover-enter border-hairline border-border-hover bg-overlay fixed z-50 rounded-lg p-1 ${className}`}
    >
      {children}
    </div>,
    document.getElementById('root') ?? document.body,
  )
}
