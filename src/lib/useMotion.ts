import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { AutoAnimationPlugin } from '@formkit/auto-animate'
import { durationMs } from './motion'

interface Timing {
  duration: number
  easing: string
}

/**
 * The timing every automatic animation shares: the panel duration and the standard
 * curve, read off the token layer once, so a retime of the suite reaches this too.
 */
let shared: Timing | undefined
export function motionTiming(): Timing {
  if (shared) return shared
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-standard')
  shared = {
    duration: durationMs('--duration-panel', 280),
    easing: easing.trim() || 'ease-in-out',
  }
  return shared
}

export const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * What each change looks like, in properties the compositor animates on its own:
 * `transform` and `opacity`, never a size.
 *
 * AutoAnimate's own keyframes tween `width` and `height` whenever a child changes
 * size, which lays the child and everything in it out again on every frame. Measured
 * on the editor at a quarter of the CPU, that dropped most frames of every choice
 * change. Here a child that moves slides from where it was, a child that changes
 * size takes its new size at once while its neighbours slide, and the sheet around
 * it glides (`useSheetSize`), which reads as the same motion for a fraction of the work.
 *
 * A plugin opts out of AutoAnimate's own reduced-motion check, so it is made here.
 */
const plugin: AutoAnimationPlugin = (el, action, first, second) => {
  const { duration, easing } = motionTiming()
  const options = { duration: reducedMotion() ? 0 : duration, easing, fill: 'none' as const }
  if (action === 'add') {
    return new KeyframeEffect(
      el,
      [
        { opacity: 0, transform: 'scale(0.98)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      options,
    )
  }
  if (action === 'remove') {
    return new KeyframeEffect(
      el,
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.98)' },
      ],
      { ...options, easing: 'ease-out' },
    )
  }
  // Remain: called with the old box first and the new one second.
  const from = first
  const to = second
  const dx = from && to ? from.left - to.left : 0
  const dy = from && to ? from.top - to.top : 0
  return new KeyframeEffect(
    el,
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
    dx === 0 && dy === 0 ? { ...options, duration: 0 } : options,
  )
}

/**
 * Motion for a container, with nothing to set up per element.
 *
 * Put the returned ref on a container and every child it gains fades in, every child it
 * loses fades out where it stood, and every child that moves because of either slides
 * to its new place. What is animated is decided by what React renders, so a field, a
 * tile or a line added later is covered the day it is written. Keys matter: a child is
 * the same child across renders only when its key is.
 *
 * Built on AutoAnimate (MIT, about 4 KB gzip), which already handles the hard part,
 * animating an element React has removed; the keyframes are this file's (`plugin`).
 */
export function useMotion<T extends HTMLElement>() {
  return useAutoAnimate<T>(plugin)
}
