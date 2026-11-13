import { useEffect, useRef, useState } from 'react'
import { CommandNav } from './CommandNav'
import type { Catalogue } from './CommandRenderer'
import { Popover } from './ui/Popover'
import { Swap } from './ui/Swap'
import { FOCUS } from './editors/fieldStyles'

/**
 * The command in the editor's header, and the way to another one.
 *
 * Takes the place of the list that used to run down the editor's side: the list is a
 * press of the command's name (or Ctrl K) away, and the space is the command's. The
 * list is `CommandNav`, filter and pins and all, so nothing it did is lost.
 */
export function CommandSwitcher({
  catalogue,
  activeId,
}: {
  catalogue: Catalogue
  activeId?: string
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const label = activeId === undefined ? 'Choose a command' : catalogue[activeId]?.label

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setOpen((was) => !was)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Escape closes the list, not the editor around it: heard in the capture phase, before
  // the editor's own listener, which leaves an Escape already handled alone.
  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onEscape, true)
    return () => document.removeEventListener('keydown', onEscape, true)
  }, [open])

  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Control+K"
        onClick={() => setOpen((was) => !was)}
        className={`${FOCUS} hover:bg-hover flex items-center gap-2 rounded-md px-1.5 py-0.5`}
      >
        <Swap text={label ?? ''} className="text-text-primary font-mono text-sm font-semibold" />
        <span aria-hidden="true" className="text-text-muted text-xs">
          ▾
        </span>
        <kbd
          aria-hidden="true"
          className="border-hairline border-border-hover text-text-faint text-1xs hidden rounded-sm px-1 font-mono sm:inline"
        >
          Ctrl K
        </kbd>
      </button>
      {open && (
        <Popover container={anchor} onDismiss={() => setOpen(false)} className="p-0">
          <CommandNav
            catalogue={catalogue}
            activeId={activeId}
            focusFilter
            onPick={() => setOpen(false)}
          />
        </Popover>
      )}
    </div>
  )
}
