import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { AutoAnimateOptions } from '@formkit/auto-animate'
import { durationMs } from './motion'

/**
 * The timing every automatic animation shares: the panel duration and the standard
 * curve, read off the token layer once, so a retime of the suite reaches this too.
 */
let shared: AutoAnimateOptions | undefined
function options(): AutoAnimateOptions {
  if (shared) return shared
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-standard')
  shared = {
    duration: durationMs('--duration-panel', 280),
    easing: easing.trim() || 'ease-in-out',
  }
  return shared
}

/**
 * Motion for a container, with nothing to set up per element.
 *
 * Put the returned ref on a container and every child it gains fades in, every child it
 * loses fades out where it stood, and every child that moves or changes size because of
 * either glides to its new box, the container's own size with it. What is animated is
 * decided by what React renders, so a field, a tile or a line added later is covered the
 * day it is written. Keys matter: a child is the same child across renders only when its
 * key is.
 *
 * Built on AutoAnimate (MIT, about 4 KB gzip), which already handles the hard part,
 * animating an element React has removed, and stands down under reduced motion.
 */
export function useMotion<T extends HTMLElement>() {
  return useAutoAnimate<T>(options())
}
