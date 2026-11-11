import { useEffect, useRef, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

/** How long "Copied" stays up after a click. */
const SHOWN_MS = 1200

/**
 * Copy text to the clipboard and say so for a moment.
 *
 * The clipboard API rejects when the page is not focused or permission is refused, and
 * the caller shows "Could not copy" rather than a success that did not happen.
 */
export function useCopy(): [CopyState, (text: string) => void] {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = (text: string) => {
    const settle = (next: CopyState) => {
      clearTimeout(timer.current)
      setState(next)
      timer.current = setTimeout(() => setState('idle'), SHOWN_MS)
    }
    const write = navigator.clipboard?.writeText(text)
    if (!write) return settle('failed')
    write.then(
      () => settle('copied'),
      () => settle('failed'),
    )
  }
  return [state, copy]
}

/** The words a copy leaves behind, or null while there is nothing to say. */
export function copyNote(state: CopyState): string | null {
  return state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : null
}
