import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A menu on the view's toolbar: open on its button, staying open while things in it are
 * changed, so several can be changed in a row. A press outside or Escape closes it.
 */
export function useToolbarMenu() {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }, [])
  const dismiss = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  // Escape closes the menu and nothing else, so it is taken before the editor hears it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])

  return { open, toggle, dismiss, wrapper, trigger }
}
