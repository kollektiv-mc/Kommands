import { useCallback, useLayoutEffect, useRef } from 'react'
import { durationMs } from './motion'
import { motionTiming, reducedMotion, sequence } from './useMotion'

/**
 * Keeps the sheet the size of what it holds, and makes a change of size one motion in
 * three steps: what leaves fades out, the sheet resizes, and what arrives fades in once
 * the sheet has its new size.
 *
 * Returns the refs it works on: the stage the sheet is centred in, the sheet, its header
 * band, the frame its content is laid out in, and the content. The content is never
 * narrower than the header needs, so the header never runs out of the sheet. The content lays itself
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

    let maxW = Infinity
    let maxH = Infinity
    const fitRoom = () => {
      const style = getComputedStyle(room)
      // A padding the engine reports as '' (no layout, as in a test) is none.
      const px = (value: string) => parseFloat(value) || 0
      const padX = px(style.paddingLeft) + px(style.paddingRight)
      const padY = px(style.paddingTop) + px(style.paddingBottom)
      maxW = room.clientWidth - padX
      maxH = room.clientHeight - padY - band.offsetHeight
      inner.style.setProperty('--sheet-max-w', `${maxW}px`)
      inner.style.setProperty('--sheet-max-h', `${maxH}px`)
    }
    let settled = false
    let glide: Animation | undefined
    /**
     * Whether the content scrolls, which only a content the room caps needs. Otherwise
     * it does not clip either, and that is the point: the content takes its new size at
     * once, while the tiles that leave fade out and the ones that stay slide from where
     * they were, both drawn where the old size had them. A content that clipped to its
     * new size cut them off there (a shrinking command lost its lower tiles mid-switch),
     * where the sheet, which still has the old size, would have held them.
     */
    const fitOverflow = (width: number, height: number) => {
      // A phone's sheet is the room's width whatever it holds (index.css), so a content
      // at that width scrolls across only when it is also wider than it.
      const across = width >= maxW - 1 && inner.scrollWidth > inner.clientWidth
      const scrolls = across || height >= maxH - 1
      // Taking the scroll away puts a scrolled content back at its top, which would jump
      // the tiles still moving. A scrolled one keeps it for now: once it fits, the browser
      // scrolls it home, and the next change takes the scroll away.
      if (!scrolls && (inner.scrollTop > 0 || inner.scrollLeft > 0)) return
      inner.style.overflow = scrolls ? 'auto' : 'visible'
    }
    /** Takes the content's size, and answers how long the sheet takes to get there. */
    const fitSheet = () => {
      // The header is laid out at the sheet's width, so the content is held at least as
      // wide as the header needs: its natural width, read by letting it size itself.
      const laidOut = band.style.width
      band.style.width = 'max-content'
      // The used width, with its fraction: rounded down, the header would truncate.
      const needs = Math.ceil(parseFloat(getComputedStyle(band).width))
      // Never past the room, which min-width would otherwise win over.
      inner.style.minWidth = `min(var(--sheet-max-w, 100%), max(var(--sheet-min-w), ${needs}px))`
      band.style.width = laidOut
      const width = inner.offsetWidth
      const height = inner.offsetHeight + band.offsetHeight
      if (width === 0 || height === 0) return 0
      // The first size is not animated. Counted here, before the early return below:
      // React's StrictMode runs this effect twice, and the second run finds the size
      // the first wrote, so counting it later let the first real change snap.
      const first = !settled
      settled = true
      // The size it is drawn at now, part way through a resize included.
      const fromW = sheet.offsetWidth
      const fromH = sheet.offsetHeight
      holder.style.width = `${inner.offsetWidth}px`
      holder.style.height = `${inner.offsetHeight}px`
      if (sheet.style.width === `${width}px` && sheet.style.height === `${height}px`) {
        fitOverflow(inner.offsetWidth, inner.offsetHeight)
        return glide?.playState === 'running' ? remaining(glide) : 0
      }
      glide?.cancel()
      glide = undefined
      sheet.style.width = `${width}px`
      sheet.style.height = `${height}px`
      const animate =
        !first &&
        !reducedMotion() &&
        sheet.style.transform === '' &&
        typeof sheet.animate === 'function' &&
        Math.abs(fromW - width) + Math.abs(fromH - height) >= 1
      if (!animate) {
        fitOverflow(inner.offsetWidth, inner.offsetHeight)
        return 0
      }
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
      fitOverflow(inner.offsetWidth, inner.offsetHeight)
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
