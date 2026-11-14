import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { stepIndex } from '../../lib/listbox'

export interface MenuAction {
  label: string
  onSelect: () => void
}

/**
 * A right-click menu at the pointer, on the popover surface.
 *
 * Konnekt's context menu in this app's terms: a short list of verbs, the arrow keys
 * between them, Escape or a press anywhere else to close. Held inside the window's
 * edges, so a menu opened near a corner opens towards the middle.
 *
 * One item is lit at a time: the one under the pointer, or the one the arrow keys
 * reached. Both move the focus, and only focus draws the highlight, so the pointer and
 * the keys can never light two. It opens with none lit, as a menu opened by the pointer
 * should.
 */
export function ContextMenu({
  at,
  actions,
  onClose,
}: {
  at: { x: number; y: number }
  actions: readonly MenuAction[]
  onClose: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = menu.current
    if (!el) return
    const edge = parseFloat(getComputedStyle(el).getPropertyValue('--popover-gap')) * 2 || 0
    const { innerWidth, innerHeight } = window
    el.style.left = `${Math.max(edge, Math.min(at.x, innerWidth - el.offsetWidth - edge))}px`
    el.style.top = `${Math.max(edge, Math.min(at.y, innerHeight - el.offsetHeight - edge))}px`
    el.focus({ preventScroll: true })
  }, [at])

  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  /** Light an item, or none: the menu itself takes the focus so the keys still reach it. */
  const light = (item: HTMLButtonElement | null) => {
    const target = item ?? menu.current
    if (target !== null && document.activeElement !== target) target.focus({ preventScroll: true })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const buttons = [...(menu.current?.querySelectorAll('button') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const down = event.key === 'ArrowDown'
    if (event.key === 'Escape') onClose()
    else if (down || event.key === 'ArrowUp') {
      buttons[stepIndex(index, down ? 1 : -1, buttons.length)]?.focus()
    } else return
    event.preventDefault()
    event.stopPropagation()
  }

  return createPortal(
    <div
      ref={menu}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={(e) => light((e.target as Element).closest('button'))}
      onPointerLeave={() => light(null)}
      className="popover popover-enter border-hairline border-border-hover bg-overlay fixed z-60 w-44 rounded-lg p-1 outline-none"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            action.onSelect()
          }}
          className="text-text-primary focus:bg-hover flex w-full items-center rounded-md px-2 py-1.5 text-left font-mono text-xs outline-none"
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.getElementById('root') ?? document.body,
  )
}
