import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { IconName } from '../../lib/icons'
import { Icon } from './Icon'
import { FOCUS } from '../editors/fieldStyles'
import { stepIndex } from '../../lib/listbox'
import { Popover } from './Popover'

export interface MenuItem {
  key: string
  label: string
  description?: string
  onSelect: () => void
  disabled?: boolean
}

/**
 * A button that opens a short list of actions: "Add component", and later "Add a step".
 *
 * A disclosure rather than an ARIA `menu`: a button with `aria-expanded` that reveals
 * ordinary buttons. The menu role promises application-style keyboard handling that
 * screen readers then switch into, and a list of two or three actions gains nothing
 * from it. The arrow keys still move between the items, and Escape closes and returns
 * focus to the button.
 */
export function MenuButton({
  label,
  items,
  icon,
  iconOnly = false,
  align = 'start',
  className = '',
}: {
  /** The button's text, and so its accessible name. */
  label: string
  items: readonly MenuItem[]
  /** Drawn before the label, e.g. `plus` for a menu that adds things. */
  icon?: IconName
  /** Draw only the icon; `label` is then the button's name and its tooltip. */
  iconOnly?: boolean
  /** Which edge the list lines up with. `end` for a button at the right of a bar. */
  align?: 'start' | 'end'
  className?: string
}) {
  const listId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  const focusItem = (delta: number) => {
    const buttons = [
      ...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons[stepIndex(at, delta, buttons.length)]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && open) {
      event.preventDefault()
      focusItem(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  return (
    // The keydown handler sits on the wrapper because the keys it serves arrive from
    // whichever button in it has focus, the trigger or an item.
    // aislop-ignore-next-line jsx-a11y/no-static-element-interactions -- delegates arrow and Escape keys from the buttons inside it
    <div ref={wrapper} className={`relative inline-flex ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        onClick={(event) => {
          event.preventDefault()
          setOpen((o) => !o)
        }}
        className={
          iconOnly
            ? `${FOCUS} text-text-muted hover:text-text-primary hover:bg-hover duration-fast flex h-8 w-8 items-center justify-center rounded-md transition-colors motion-reduce:transition-none`
            : `${FOCUS} text-accent hover:bg-accent/10 duration-fast inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors motion-reduce:transition-none`
        }
      >
        {icon && <Icon name={icon} size={iconOnly ? 'md' : 'sm'} />}
        {!iconOnly && label}
      </button>
      {open && (
        <Popover container={wrapper} onDismiss={close} align={align}>
          <div ref={list} id={listId} className="flex min-w-48 flex-col gap-px">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                // The description is said after the name rather than run into it, so
                // a disabled item reads "Link to Konnekt", then why it is off.
                aria-labelledby={item.description ? `${listId}-${item.key}-label` : undefined}
                aria-describedby={item.description ? `${listId}-${item.key}` : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  setOpen(false)
                  trigger.current?.focus()
                  item.onSelect()
                }}
                className="hover:bg-hover focus-visible:bg-hover duration-fast flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                <span
                  id={`${listId}-${item.key}-label`}
                  className="text-text-primary whitespace-nowrap"
                >
                  {item.label}
                </span>
                {item.description && (
                  <span
                    id={`${listId}-${item.key}`}
                    className="text-text-muted text-1xs ml-auto whitespace-nowrap"
                  >
                    {item.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  )
}
