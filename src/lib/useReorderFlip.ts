import { useCallback, useLayoutEffect, useRef } from 'react'
import { durationMs } from './motion'

/**
 * Items of a list glide to their new place when it is reordered, rather than jumping.
 *
 * FLIP: `capture()` records where each item is just before the change, and after the
 * change has been laid out each item is moved back by the difference and released, on
 * the compositor, through the Web Animations API. Positions are captured on demand
 * rather than after every render, because a list that grew or collapsed a card in the
 * meantime has moved everything below, and a stale position would animate that as
 * though it were part of the reorder.
 *
 * `skip` is the item under the pointer during a drag, which is already where the
 * pointer put it and would fight the pointer if it were animated too. Nothing moves
 * under reduced motion, and nothing moves where there is no layout (jsdom).
 */
export function useReorderFlip<K>(order: readonly K[], skip: K | null) {
  const elements = useRef(new Map<K, HTMLElement>())
  const before = useRef<Map<K, number> | null>(null)

  const register = useCallback((key: K, element: HTMLElement | null) => {
    if (element === null) elements.current.delete(key)
    else elements.current.set(key, element)
  }, [])

  const capture = useCallback(() => {
    before.current = new Map([...elements.current].map(([key, el]) => [key, el.offsetTop]))
  }, [])

  useLayoutEffect(() => {
    const was = before.current
    before.current = null
    if (was === null) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const duration = durationMs('--duration-panel', 280)
    // Read off the document for the reason `durationMs` gives: the curve is a token.
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue('--ease-standard').trim() ||
      'ease'
    for (const [key, el] of elements.current) {
      const from = was.get(key)
      if (from === undefined || key === skip || typeof el.animate !== 'function') continue
      const by = from - el.offsetTop
      if (Math.abs(by) < 1) continue
      el.animate([{ transform: `translateY(${by}px)` }, { transform: 'none' }], {
        duration,
        easing,
      })
    }
  }, [order, skip])

  return { register, capture }
}
