import { useEffect, useState } from 'react'

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
