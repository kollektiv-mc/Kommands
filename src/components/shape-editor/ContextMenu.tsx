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
    el.querySelector('button')?.focus({ preventScroll: true })
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

  const onKeyDown = (event: KeyboardEvent) => {
    const buttons = [...(menu.current?.querySelectorAll('button') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      buttons[stepIndex(index, event.key === 'ArrowDown' ? 1 : -1, buttons.length)]?.focus()
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
      className="popover popover-enter border-hairline border-border-hover bg-overlay fixed z-60 w-44 rounded-lg p-1"
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
          className="text-text-primary hover:bg-hover focus:bg-hover flex w-full items-center rounded-md px-2 py-1.5 text-left font-mono text-xs outline-none"
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.getElementById('root') ?? document.body,
  )
}
