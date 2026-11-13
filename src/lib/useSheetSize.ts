import { useLayoutEffect, useRef } from 'react'
import { motionTiming, reducedMotion } from './useMotion'

/**
 * Keeps the sheet the size of what it holds, and makes a change of size a glide.
 *
 * Returns the refs it works on: the stage the sheet is centred in, the sheet, the
 * surface that draws it (its background and border), and its content. The content lays
 * itself out at its natural size, capped by what the stage leaves (`--sheet-max-w`,
 * `--sheet-max-h`), and a ResizeObserver hands every change to the sheet.
 *
 * The sheet takes its new size at once, so the content is laid out once per change.
 * What glides is two transforms the compositor runs alone: the sheet slides from where
 * it was (re-centring moves it), and the surface scales from the size it had. Tweening
 * `width` and `height` instead laid the whole editor out again on every frame, which
 * measured as most of the frames a choice change dropped.
 *
 * Neither animates the first size, so the sheet opens at its size, nor while the
 * sheet is opening (`flipIn` owns its transform then).
 */
export function useSheetSize<T extends HTMLElement>() {
  const stage = useRef<T>(null)
  const box = useRef<T>(null)
  const surface = useRef<T>(null)
  const content = useRef<T>(null)
  useLayoutEffect(() => {
    const room = stage.current
    const sheet = box.current
    const face = surface.current
    const inner = content.current
    if (!room || !sheet || !face || !inner) return

    const fitRoom = () => {
      const style = getComputedStyle(room)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      inner.style.setProperty('--sheet-max-w', `${room.clientWidth - padX}px`)
      inner.style.setProperty('--sheet-max-h', `${room.clientHeight - padY}px`)
    }
    let settled = false
    let glides: Animation[] = []
    const fitSheet = () => {
      // Layout sizes, not the bounding box, which a transform would scale.
      const width = inner.offsetWidth
      const height = inner.offsetHeight
      if (width === 0 || height === 0) return
      const animate = settled && !reducedMotion() && sheet.style.transform === ''
      // Where the surface is drawn now, part way through a glide included.
      const was = animate ? face.getBoundingClientRect() : undefined
      glides.forEach((glide) => glide.cancel())
      glides = []
      sheet.style.width = `${width}px`
      sheet.style.height = `${height}px`
      settled = true
      if (!was || typeof sheet.animate !== 'function') return
      const now = sheet.getBoundingClientRect()
      const dx = was.left - now.left
      const dy = was.top - now.top
      const sx = was.width / now.width
      const sy = was.height / now.height
      if (Math.abs(dx) + Math.abs(dy) < 0.5 && Math.abs(sx - 1) + Math.abs(sy - 1) < 0.002) return
      const { duration, easing } = motionTiming()
      glides = [
        sheet.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], {
          duration,
          easing,
        }),
        face.animate([{ scale: `${sx} ${sy}` }, { scale: '1 1' }], { duration, easing }),
      ]
    }
    fitRoom()
    fitSheet()
    if (typeof ResizeObserver === 'undefined') return
    const roomObserver = new ResizeObserver(fitRoom)
    const contentObserver = new ResizeObserver(fitSheet)
    roomObserver.observe(room)
    contentObserver.observe(inner)
    return () => {
      roomObserver.disconnect()
      contentObserver.disconnect()
      glides.forEach((glide) => glide.cancel())
    }
  }, [])
  return { stage, sheet: box, surface, content }
}
