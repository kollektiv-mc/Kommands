import { useEffect, useRef } from 'react'
import { startHero } from '../../lib/hero/player'
import { reducedMotion } from '../../lib/useMotion'
import { HERO_SEQUENCE, HERO_SHAPES } from '../../data/home/hero'

/**
 * The hero: a command that types itself, then turns into its own editor.
 *
 * React renders the host and never its contents; lib/hero/player.ts plays into it and
 * says why. Decoration for assistive technology, which reads the page's heading instead.
 */
export function Hero() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    return startHero(node, HERO_SEQUENCE, HERO_SHAPES, reducedMotion())
  }, [])

  return <div ref={host} className="hero" aria-hidden="true" />
}
