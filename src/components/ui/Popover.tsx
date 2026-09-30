import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'

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
 * Absolute inside the trigger's `relative` wrapper rather than portalled: the editor is
 * one scroll container, and a portalled panel has to be re-positioned on every scroll
 * of it, which is the bug Konnekt's portalled quick-add menu still has open (its issue 139).
 * When there is less room below the trigger than above, it opens upward instead.
 */
export function Popover({
  container,
  onDismiss,
  align = 'start',
  className = '',
  children,
}: {
  /** The `relative` wrapper around the trigger and this panel. A press outside it dismisses. */
  container: RefObject<HTMLElement | null>
  onDismiss: () => void
  /** Which edge of the trigger it lines up with. `end` for a control at the right edge. */
  align?: 'start' | 'end'
  className?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  // Placement is written straight onto the element rather than through state: it is
  // measured once per opening, and a state update here would render the panel twice
  // on every open to move it by its own height.
  useLayoutEffect(() => {
    const el = panel.current
    const anchor = container.current
    if (!el || !anchor) return
    const box = anchor.getBoundingClientRect()
    const below = window.innerHeight - box.bottom
    const above = box.top
    el.dataset.side = below < el.offsetHeight + 8 && above > below ? 'top' : 'bottom'
  }, [container])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [container, onDismiss])

  return (
    <div
      ref={panel}
      data-side="bottom"
      className={
        `popover-enter border-hairline border-border-hover bg-overlay absolute ${align === 'end' ? 'right-0' : 'left-0'} z-20 min-w-full rounded-lg p-1 ` +
        'data-[side=bottom]:top-full data-[side=bottom]:mt-1 data-[side=top]:bottom-full data-[side=top]:mb-1 ' +
        className
      }
    >
      {children}
    </div>
  )
}
