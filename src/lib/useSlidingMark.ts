import { useLayoutEffect, useRef } from 'react'

/**
 * Moves a highlight to whichever child matches `selector`, so it slides there instead
 * of disappearing from one and appearing on the next.
 *
 * The mark is an element of its own inside the container (`.slide-mark` in
 * `styles/index.css`), placed by transform; this writes its box and the stylesheet
 * moves it. Re-placed whenever `key` changes, which is whatever decides the match.
 * Returns the refs for the container and the mark.
 */
export function useSlidingMark<C extends HTMLElement, M extends HTMLElement>(
  selector: string,
  key: unknown,
) {
  const container = useRef<C>(null)
  const mark = useRef<M>(null)
  useLayoutEffect(() => {
    const box = container.current
    const el = mark.current
    if (!box || !el) return
    const target = box.querySelector<HTMLElement>(selector)
    if (!target) {
      el.dataset.shown = 'false'
      return
    }
    const first = el.dataset.shown !== 'true'
    // A mark that was hidden appears where it is going, rather than sliding in from
    // wherever it was last.
    if (first) el.classList.remove('slide-mark-moving')
    el.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`
    el.style.width = `${target.offsetWidth}px`
    el.style.height = `${target.offsetHeight}px`
    el.dataset.shown = 'true'
    if (first) {
      void el.offsetHeight
      el.classList.add('slide-mark-moving')
    }
  }, [selector, key])
  return { container, mark }
}
