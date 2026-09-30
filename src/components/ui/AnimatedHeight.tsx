import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { durationMs } from '../../lib/motion'

const prefersLessMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * A box whose height glides when what it holds is swapped out.
 *
 * `contentKey` names what is inside. When it changes (a Choice switching branch), the
 * box pins the height it had, lets the new content render, and animates `max-height` to
 * the new height before letting go. Between swaps it is an ordinary box that grows and
 * shrinks with its content, so typing that adds a warning line does not animate.
 *
 * The technique is `ui/Collapsible`'s: measure, pin, flush with a forced reflow, then
 * write the target, and release on `transitionend` or a timer, whichever is first. It
 * clips only while it moves, so a list opened from a field inside it is never cut off.
 * No transform, which would make it the containing block of everything inside it.
 */
export function AnimatedHeight({
  contentKey,
  className = '',
  children,
}: {
  contentKey: string
  className?: string
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const settled = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    const from = settled.current
    if (!el || from === null || prefersLessMotion()) return
    const to = el.scrollHeight
    if (from === to) return

    el.style.maxHeight = `${from}px`
    el.style.overflow = 'hidden'
    // The flush that makes the pinned height the one the transition starts from.
    void el.offsetHeight
    el.classList.add('height-glide')
    el.style.maxHeight = `${to}px`

    const release = () => {
      el.classList.remove('height-glide')
      el.style.maxHeight = ''
      el.style.overflow = ''
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === 'max-height') release()
    }
    el.addEventListener('transitionend', onEnd)
    const timer = window.setTimeout(release, durationMs('--duration-panel', 280) + 120)
    return () => {
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(timer)
      release()
    }
  }, [contentKey])

  // Recorded after every render, so the next swap starts from the height the box
  // actually had, including any growth since the last one.
  useLayoutEffect(() => {
    if (box.current) settled.current = box.current.offsetHeight
  })

  return (
    <div ref={box} className={className}>
      <div key={contentKey} className="content-in flex flex-col">
        {children}
      </div>
    </div>
  )
}
