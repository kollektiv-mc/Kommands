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
 * change. Here a child that moves slides from where it was, and a child that changes
 * size takes its new size at once while its neighbours slide.
 *
 * The three run in order rather than together (`sequence`): what leaves fades out,
 * then what stays slides while the sheet resizes, then what arrives fades in. Run
 * together, a new tile was drawn before the sheet had grown to hold it.
 *
 * A plugin opts out of AutoAnimate's own reduced-motion check, so it is made here.
 */
const plugin: AutoAnimationPlugin = (el, action, first, second) => {
  const { duration, easing } = motionTiming()
  const quick = durationMs('--duration-fast', 150)
  const still = reducedMotion()
  if (action === 'add') {
    return track(
      'add',
      new KeyframeEffect(
        el,
        [
          { opacity: 0, transform: 'scale(0.98)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: still ? 0 : quick, easing: 'ease-out', fill: 'backwards' },
      ),
    )
  }
  if (action === 'remove') {
    return track(
      'remove',
      new KeyframeEffect(
        el,
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(0.98)' },
        ],
        { duration: still ? 0 : quick, easing: 'ease-out' },
      ),
    )
  }
  // Remain: called with the old box first and the new one second.
  const dx = first && second ? first.left - second.left : 0
  const dy = first && second ? first.top - second.top : 0
  return track(
    'remain',
    new KeyframeEffect(
      el,
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: still || (dx === 0 && dy === 0) ? 0 : duration, easing, fill: 'backwards' },
    ),
  )
}

export type Step = 'add' | 'remove' | 'remain'

/** The effects one change made, waiting to be put in order. */
let batch: { step: Step; effect: KeyframeEffect }[] = []
let fallback = 0

/** Holds an effect for `sequence` to put in order. Exported for its tests. */
export function track(step: Step, effect: KeyframeEffect) {
  batch.push({ step, effect })
  // Ordered by the sheet when the change resizes it (`useSheetSize`), which happens on
  // the next frame; otherwise here, the frame after, with no resize to wait for.
  if (fallback === 0) {
    fallback = requestAnimationFrame(() => {
      fallback = requestAnimationFrame(() => void sequence(0))
    })
  }
  return effect
}

/**
 * Puts the last change's motion in order around a resize lasting `resize` ms: the
 * leaving tiles fade out first, the staying ones slide during the resize, and the new
 * ones fade in after it. Answers how long the resize should wait for the leaving ones.
 */
export function sequence(resize: number): number {
  const pending = batch
  batch = []
  cancelAnimationFrame(fallback)
  fallback = 0
  const leaving = Math.max(0, ...pending.filter((p) => p.step === 'remove').map(duration))
  for (const { step, effect } of pending) {
    if (step === 'remain') effect.updateTiming({ delay: leaving })
    if (step === 'add') effect.updateTiming({ delay: leaving + resize })
  }
  return leaving
}

const duration = ({ effect }: { effect: KeyframeEffect }) =>
  Number(effect.getTiming().duration) || 0

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
