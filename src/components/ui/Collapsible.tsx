import { useEffect, useRef, useState, type ReactNode } from 'react'
import { durationMs } from '../../lib/motion'

/**
 * A vertical collapse that animates `max-height` between zero and the **measured**
 * content height.
 *
 * Ported from Konnekt's `ui/Collapsible`, and the reason for taking its shape rather
 * than the obvious one is a finding this repo would otherwise have to make for itself.
 * `grid-template-rows: 0fr → 1fr` is the modern, shorter answer and it leaves a
 * residual sliver of content visible on Wails' WebKit WebView — which is precisely the
 * engine Kommands' standalone build runs in. Konnekt reverted a tile to `max-height`
 * over exactly that. A measured height is also why open and close travel the same
 * distance: a fixed magic number makes one of the two directions wrong.
 *
 * The cost is one `style` write per toggle, which this repo bans across `src/**` by
 * ESLint rather than by directory. The disable below is the documented exception the
 * rule provides for: a height measured at runtime is not something Tailwind's static
 * scanner can ever emit a class for. It is held to exactly that one property — the
 * transition itself is the `.collapsible` class in `styles/index.css`, because it is
 * static, and because a transition declared in JSX is somewhere
 * `prefers-reduced-motion` cannot reach.
 */
export function Collapsible({
  open,
  children,
  className = '',
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState(open ? 'none' : '0px')

  // Which toggle the release timer below belongs to, so a timer that somehow outlives
  // its own cleanup still cannot write over a later state.
  const generation = useRef(0)

  useEffect(() => {
    const outer = box.current
    const content = inner.current
    if (!outer || !content) return
    const mine = ++generation.current
    const target = open ? `${content.scrollHeight}px` : '0px'

    // A transition needs a starting value the browser has actually computed. An open
    // panel sits at `max-height: none`, which does not interpolate, and a panel
    // toggled twice in one frame can have its previous value never computed at all —
    // either way the change arrives with nothing to travel from and the panel jumps.
    //
    // So: pin where it *is*, read a layout property to force that to be computed there
    // and then, write where it is going. No frame budget can reorder a synchronous
    // flush, which is what the two-animation-frame version this replaces depended on.
    // Konnekt measured that version failing 74 of 220 closes under a 6× CPU throttle;
    // clicking during another section's animation is the same coalescing on a real
    // machine, which is how it was found.
    //
    // The pin is the height it is at, not the one it would be. Those agree for a
    // settled panel and do not for one caught mid-travel, where pinning the far end
    // would snap it there before animating back.
    outer.style.maxHeight = `${outer.getBoundingClientRect().height}px`
    void outer.offsetHeight
    outer.style.maxHeight = target
    setMaxHeight(target)

    if (!open) return
    // A net for the release below, not the thing that normally performs it: a
    // transition that never runs fires no `transitionend`, and an open panel left
    // capped at its measured height re-clips children that grow afterwards — which on
    // this dashboard is every tile added by a save. Deliberately longer than the
    // transition, so the real event wins the race wherever there is one.
    const timer = setTimeout(
      () => {
        if (generation.current === mine) setMaxHeight('none')
      },
      durationMs('--duration-panel', 280) + 120,
    )
    return () => clearTimeout(timer)
  }, [open])

  return (
    <div
      ref={box}
      className={`collapsible overflow-hidden ${className}`}
      // The cap comes off when the open transition genuinely finishes, rather than
      // when a timer started one commit earlier guesses that it has — that timer
      // always fires a frame or two early, so the last pixels of every open were a
      // jump rather than a glide.
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget || e.propertyName !== 'max-height') return
        if (open) setMaxHeight('none')
      }}
      // eslint-disable-next-line no-restricted-syntax -- a measured runtime height, which no static class can carry; see the doc comment
      style={{ maxHeight }}
    >
      <div ref={inner}>{children}</div>
    </div>
  )
}
