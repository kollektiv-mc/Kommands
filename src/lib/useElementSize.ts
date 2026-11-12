import { useCallback, useState } from 'react'

export interface Size {
  width: number
  height: number
}

/**
 * The content size of an element, kept current with a `ResizeObserver`.
 *
 * Returns a callback ref and the last size, or `null` until the first measurement and
 * wherever `ResizeObserver` does not exist (jsdom). Callers treat `null` as "use a
 * sensible default", so a test sees one full page.
 */
export function useElementSize<T extends HTMLElement>(): [(el: T | null) => void, Size | null] {
  const [size, setSize] = useState<Size | null>(null)
  const ref = useCallback((el: T | null) => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      setSize((was) => (was?.width === width && was.height === height ? was : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}
