import { useCallback, useLayoutEffect, useRef } from 'react'
import { durationMs } from './motion'
import { motionTiming, reducedMotion, sequence } from './useMotion'

/**
 * Keeps the sheet the size of what it holds, and makes a change of size one motion in
 * three steps: what leaves fades out, the sheet resizes, and what arrives fades in once
 * the sheet has its new size.
 *
 * Returns the refs it works on: the stage the sheet is centred in, the sheet, its header
 * band, the frame its content is laid out in, and the content. The content lays itself
 * out at its natural size, capped by what the stage leaves (`--sheet-max-w`,
 * `--sheet-max-h`), and a ResizeObserver hands every change to the sheet.
 *
 * The sheet's own width and height are what animate, so the surface, its border and
 * corners, and the header band are drawn at the size the sheet has on that frame and
 * never ahead of it. That costs a layout per frame of the sheet and its header only:
 * the content sits in a frame of fixed size (`frame`), so nothing inside it is laid out
 * again while the sheet moves around it, and the sheet clips what does not fit yet.
 * The stage centres the sheet, so the resize is also the re-centring.
 *
 * Neither animates the first size, so the sheet opens at its size, nor while the sheet
 * is opening (`flipIn` owns its transform then).
 *
 * `leave` and `settle` bracket a change that replaces the whole content (another
 * command): `leave` fades the content out and resolves once it has, the caller swaps
 * the content, and `settle` resizes to the new content and only then fades it in. A
 * change inside the content (a choice) needs neither: the tiles that leave and arrive
 * are animated by `useMotion`, and put in order around the resize here (`sequence`).
 */
export function useSheetSize<T extends HTMLElement>() {
  const stage = useRef<T>(null)
  const box = useRef<T>(null)
  const header = useRef<T>(null)
  const frame = useRef<T>(null)
  const content = useRef<T>(null)
  const fit = useRef<() => number>(() => 0)
  const hidden = useRef(false)
  const reveal = useRef<Animation | undefined>(undefined)

  useLayoutEffect(() => {
    const room = stage.current
    const sheet = box.current
    const band = header.current
    const holder = frame.current
    const inner = content.current
    if (!room || !sheet || !band || !holder || !inner) return

    const fitRoom = () => {
      const style = getComputedStyle(room)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      inner.style.setProperty('--sheet-max-w', `${room.clientWidth - padX}px`)
      inner.style.setProperty('--sheet-max-h', `${room.clientHeight - padY - band.offsetHeight}px`)
    }
    let settled = false
    let glide: Animation | undefined
    /** Takes the content's size, and answers how long the sheet takes to get there. */
    const fitSheet = () => {
      const width = inner.offsetWidth
      const height = inner.offsetHeight + band.offsetHeight
      if (width === 0 || height === 0) return 0
      // The size it is drawn at now, part way through a resize included.
      const fromW = sheet.offsetWidth
      const fromH = sheet.offsetHeight
      holder.style.width = `${inner.offsetWidth}px`
      holder.style.height = `${inner.offsetHeight}px`
      if (sheet.style.width === `${width}px` && sheet.style.height === `${height}px`) {
        return glide?.playState === 'running' ? remaining(glide) : 0
      }
      glide?.cancel()
      glide = undefined
      sheet.style.width = `${width}px`
      sheet.style.height = `${height}px`
      const animate =
        settled &&
        !reducedMotion() &&
        sheet.style.transform === '' &&
        typeof sheet.animate === 'function' &&
        Math.abs(fromW - width) + Math.abs(fromH - height) >= 1
      settled = true
      if (!animate) return 0
      const { duration, easing } = motionTiming()
      // After the tiles that leave have faded, and before the ones that arrive.
      const delay = sequence(duration)
      glide = sheet.animate(
        [
          { width: `${fromW}px`, height: `${fromH}px` },
          { width: `${width}px`, height: `${height}px` },
        ],
        { duration, delay, easing, fill: 'backwards' },
      )
      return delay + duration
    }
    fit.current = fitSheet
    fitRoom()
    fitSheet()
    if (typeof ResizeObserver === 'undefined') return
    const roomObserver = new ResizeObserver(fitRoom)
    const contentObserver = new ResizeObserver(() => {
      fitSheet()
    })
    roomObserver.observe(room)
    roomObserver.observe(band)
    contentObserver.observe(inner)
    return () => {
      roomObserver.disconnect()
      contentObserver.disconnect()
      glide?.cancel()
    }
  }, [])

  /** Fades the content out, for a change that replaces it. Resolves once it is out. */
  const leave = useCallback(async () => {
    const inner = content.current
    if (!inner || hidden.current) return
    hidden.current = true
    // A switch made while the last one is still fading in starts from where that is.
    reveal.current?.cancel()
    if (reducedMotion() || typeof inner.animate !== 'function') {
      inner.style.opacity = '0'
      return
    }
    const out = inner.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: durationMs('--duration-fast', 150),
      easing: 'ease-out',
    })
    inner.style.opacity = '0'
    await out.finished.catch(() => undefined)
  }, [])

  /** Resizes to the content now in place, then fades it in. A no-op unless `leave` ran. */
  const settle = useCallback(() => {
    const inner = content.current
    if (!inner || !hidden.current) return
    hidden.current = false
    const wait = fit.current()
    inner.style.opacity = ''
    if (reducedMotion() || typeof inner.animate !== 'function') return
    reveal.current = inner.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: durationMs('--duration-fast', 150),
      delay: wait,
      easing: 'ease-out',
      fill: 'backwards',
    })
  }, [])

  return { stage, sheet: box, header, frame, content, leave, settle }
}

/** What is left of an animation, in milliseconds. */
function remaining(animation: Animation): number {
  const timing = animation.effect?.getComputedTiming()
  const end = Number(timing?.endTime ?? 0)
  const now = Number(animation.currentTime ?? end)
  return Math.max(0, end - now)
}
