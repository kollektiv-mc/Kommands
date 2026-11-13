import { useLayoutEffect, useRef } from 'react'

/**
 * Keeps the sheet the size of what it holds, and makes a change of size a glide.
 *
 * Returns the three refs it works on: the stage the sheet is centred in, the sheet, and
 * its content. The sheet is given its content's size in pixels, so CSS can transition
 * between two sizes it knows; `auto` cannot be transitioned to. The content lays itself
 * out at its natural size, capped by what the stage leaves (`--sheet-max-w`,
 * `--sheet-max-h`), and a ResizeObserver hands every change to the sheet. The first
 * size is written without a transition, so the sheet opens at its size rather than
 * growing into it.
 */
export function useSheetSize<T extends HTMLElement>() {
  const stage = useRef<T>(null)
  const box = useRef<T>(null)
  const content = useRef<T>(null)
  useLayoutEffect(() => {
    const room = stage.current
    const sheet = box.current
    const inner = content.current
    if (!room || !sheet || !inner) return

    const fitRoom = () => {
      const style = getComputedStyle(room)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      inner.style.setProperty('--sheet-max-w', `${room.clientWidth - padX}px`)
      inner.style.setProperty('--sheet-max-h', `${room.clientHeight - padY}px`)
    }
    let settled = false
    const fitSheet = () => {
      // Layout sizes, not the bounding box: the sheet opens with a transform on it
      // (`flipIn`), and a scaled measurement would stick until the content next changed.
      const width = inner.offsetWidth
      const height = inner.offsetHeight
      if (width === 0 || height === 0) return
      if (!settled) sheet.classList.remove('sheet-glide')
      sheet.style.width = `${width}px`
      sheet.style.height = `${height}px`
      if (!settled) {
        void sheet.offsetHeight
        sheet.classList.add('sheet-glide')
        settled = true
      }
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
    }
  }, [])
  return { stage, sheet: box, content }
}
