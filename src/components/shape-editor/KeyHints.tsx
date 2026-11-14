import { useEffect, useState } from 'react'

const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

/** What the view's mouse and the editor's keys do, as `[keys, what]`. */
const HINTS: readonly (readonly [string, string])[] = [
  ['Left drag', 'orbit'],
  ['Right drag', 'zoom'],
  ['Middle drag', 'pan'],
  ['Click', 'select, again for the one behind'],
  ['Enter', 'edit'],
  ['Esc', 'view'],
  ['W E R', 'move, rotate, scale'],
  ['Middle drag', 'a number: ↕ step, ↔ value'],
  ['F', 'focus'],
  ['S', 'isolate'],
  ['Right click', 'menu'],
  [`${MOD} D`, 'duplicate'],
  [`${MOD} Z`, 'undo'],
  ['Del', 'remove'],
]

/**
 * The editor's keys and mouse, shown while Alt is held: the app has no help text, so
 * this is where they are written down. Gone on release, or when the window loses focus
 * with Alt still down.
 */
export function KeyHints() {
  return (
    <ul
      aria-label="Keys"
      className="bg-canvas/80 text-text-secondary text-1xs flex flex-wrap gap-x-3 gap-y-1 rounded-sm px-2 py-1 font-mono"
    >
      {HINTS.map(([keys, what]) => (
        <li key={`${keys} ${what}`} className="whitespace-nowrap">
          <kbd className="border-hairline border-border-hover text-text-primary text-2xs mr-1 rounded-sm px-1 font-mono">
            {keys}
          </kbd>
          {what}
        </li>
      ))}
    </ul>
  )
}

/** Whether Alt is held, on its own. */
export function useAltHeld(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return
      // Alone, Alt would otherwise move focus to the browser's menu bar.
      event.preventDefault()
      setHeld(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setHeld(false)
    }
    const away = () => setHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', away)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', away)
    }
  }, [])
  return held
}
