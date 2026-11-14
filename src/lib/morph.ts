import { motionTiming, reducedMotion } from './useMotion'

/**
 * The editor opening out of the tile that opened it, and closing back into it.
 *
 * A container transform rather than a FLIP of the sheet: what moves is the tile's own
 * surface, its border and corners redrawn at every size between the tile and the sheet,
 * so it reads as the tile becoming the editor. `flipIn` scaled the finished sheet down
 * onto the tile and faded it in, which read as a box appearing over the tile rather
 * than the tile growing; it stays the fallback where there is no tile to grow from.
 *
 * Three layers, in step on one timing:
 *
 * - **The ghost**, a plain surface the size of the tile, laid out at each size on its
 *   way to the sheet's. It is one empty box, so laying it out per frame costs nothing,
 *   which is what buys a border and corners that do not stretch.
 * - **A copy of the tile** inside it, at the tile's own size, fading out over the first
 *   third: the tile's content stays where it was in the tile while the tile grows.
 * - **The sheet**, centred on the ghost and clipped to its size at each frame, fading in
 *   after the copy has gone: the editor travels inside the growing tile.
 *
 * The tile on the dashboard is hidden while it is the thing moving, so there are never
 * two of it on screen. Closing plays the same three in reverse into wherever the tile
 * is now.
 */

/** The sheet's surface (`CommandOverlay`), which the ghost draws while it moves. */
const SURFACE =
  'border-hairline border-border-subtle bg-canvas pointer-events-none absolute overflow-hidden ' +
  'bg-[linear-gradient(var(--bg-surface),var(--bg-surface))]'

/** How much of the motion the copy of the tile takes to fade, and the sheet waits. */
const HANDOVER = 0.35
/** Closing is the same gesture, a little quicker, as an exit usually is. */
const CLOSE_SCALE = 0.85

interface Box {
  top: number
  left: number
  width: number
  height: number
  radius: string
}

/** `element`'s box relative to `host`, and the radius its corners are drawn with. */
function boxIn(element: Element, host: DOMRect, radius: string): Box {
  const r = element.getBoundingClientRect()
  return {
    top: r.top - host.top,
    left: r.left - host.left,
    width: r.width,
    height: r.height,
    radius,
  }
}

const radiusOf = (element: Element | null) =>
  (element && getComputedStyle(element).borderTopLeftRadius) || '0px'

const place = ({ top, left, width, height, radius }: Box) => ({
  top: `${top}px`,
  left: `${left}px`,
  width: `${width}px`,
  height: `${height}px`,
  borderRadius: radius,
})

/**
 * The sheet laid out at `sheet`, moved so its centre is the ghost's and clipped to the
 * ghost's size: the editor travels with the tile as it grows, rather than being
 * uncovered where it will end up. Both are linear in the ghost's box, so on one easing
 * they stay in step with it at every frame.
 */
function over(sheet: Box, ghost: Box) {
  const dx = ghost.left + ghost.width / 2 - (sheet.left + sheet.width / 2)
  const dy = ghost.top + ghost.height / 2 - (sheet.top + sheet.height / 2)
  const x = (sheet.width - ghost.width) / 2
  const y = (sheet.height - ghost.height) / 2
  return {
    transform: `translate(${dx}px, ${dy}px)`,
    clipPath: `inset(${y}px ${x}px ${y}px ${x}px round ${ghost.radius})`,
  }
}

interface Parts {
  /** The sheet, at its final place and size. */
  panel: HTMLElement
  /** The tile it grows from or shrinks into. */
  tile: HTMLElement
  /** What the ghost is drawn in: the positioned stage the sheet is centred in. */
  host: HTMLElement
}

/** The ghost and the copy of the tile, set up at the tile's place. */
function ghostOf({ panel, tile, host }: Parts) {
  const room = host.getBoundingClientRect()
  const from = boxIn(tile, room, radiusOf(tile))
  // The sheet's corners are its surface's, the first thing drawn in it.
  const to = boxIn(panel, room, radiusOf(panel.firstElementChild))
  if (from.width === 0 || from.height === 0 || to.width === 0 || to.height === 0) return null

  const ghost = document.createElement('div')
  ghost.className = SURFACE
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, place(from))
  // First in the stage, so the sheet paints over it once the sheet is in.
  host.prepend(ghost)

  const copy = tile.cloneNode(true) as HTMLElement
  for (const name of ['id', 'data-origin', 'data-saved-id']) copy.removeAttribute(name)
  copy.setAttribute('aria-hidden', 'true')
  copy.inert = true
  // Over the ghost's own border, at the tile's size, so at the start it is the tile.
  const border = getComputedStyle(ghost).borderTopWidth || '0px'
  Object.assign(copy.style, {
    position: 'absolute',
    top: `-${border}`,
    left: `-${border}`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
  })
  ghost.append(copy)
  return { ghost, copy, from, to }
}

function fadeBackdrop(backdrop: HTMLElement | null, opening: boolean, duration: number) {
  if (!backdrop) return
  backdrop.style.transition = 'none'
  if (opening) backdrop.style.opacity = '0'
  void backdrop.offsetHeight
  backdrop.style.transition = `opacity ${duration}ms ease-out`
  backdrop.style.opacity = opening ? '' : '0'
}

/**
 * Hides the tile while it is the thing moving, or shows it again. With its transition
 * off: a tile transitions `all`, and visibility is held visible for the whole of a
 * transition to hidden, which left the tile on screen beside its own ghost.
 */
function hide(tile: HTMLElement, hidden: boolean) {
  tile.style.transition = hidden ? 'none' : ''
  tile.style.visibility = hidden ? 'hidden' : ''
}

const canAnimate = (parts: Parts) => !reducedMotion() && typeof parts.panel.animate === 'function'

/**
 * Grow the sheet out of `tile`. Returns a cleanup for the caller's effect, or null when
 * there is nothing to grow from (no layout, reduced motion), for the caller to fall back.
 */
export function morphIn(parts: Parts, backdrop: HTMLElement | null): (() => void) | null {
  if (!canAnimate(parts)) return null
  const made = ghostOf(parts)
  if (!made) return null
  const { ghost, copy, from, to } = made
  const { panel, tile } = parts
  const { duration, easing } = motionTiming()
  const timing = { duration, easing }

  hide(tile, true)
  fadeBackdrop(backdrop, true, duration)
  const running = [
    ghost.animate([place(from), place(to)], timing),
    copy.animate([{ opacity: 1 }, { opacity: 0, offset: HANDOVER }, { opacity: 0 }], {
      duration,
      fill: 'forwards',
    }),
    panel.animate(
      [
        { ...over(to, from), opacity: 0 },
        { opacity: 0, offset: HANDOVER },
        { ...over(to, to), opacity: 1 },
      ],
      timing,
    ),
  ]
  const finish = () => {
    for (const animation of running) animation.cancel()
    ghost.remove()
    hide(tile, false)
    if (backdrop) backdrop.style.transition = ''
  }
  running[0]!.finished.then(finish, () => undefined)
  return finish
}

/**
 * Shrink the sheet back into `tile`, then call `done`, which navigates away. Returns
 * false when it cannot run, and then calls nothing, for the caller's fallback.
 */
export function morphOut(parts: Parts, backdrop: HTMLElement | null, done: () => void): boolean {
  if (!canAnimate(parts)) return false
  const made = ghostOf(parts)
  if (!made) return false
  const { ghost, copy, from, to } = made
  const { panel, tile } = parts
  const motion = motionTiming()
  const timing = { duration: Math.round(motion.duration * CLOSE_SCALE), easing: motion.easing }

  hide(tile, true)
  fadeBackdrop(backdrop, false, timing.duration)
  // Halfway rather than at HANDOVER: the copy cannot arrive while the ghost is still
  // much bigger than it, and a sheet gone by a third left an empty box for the middle.
  const half = 0.5
  const shrink = ghost.animate([place(to), place(from)], { ...timing, fill: 'forwards' })
  copy.animate([{ opacity: 0 }, { opacity: 0, offset: half }, { opacity: 1 }], {
    duration: timing.duration,
    fill: 'forwards',
  })
  panel.animate(
    [
      { ...over(to, to), opacity: 1 },
      { opacity: 0, offset: half },
      { ...over(to, from), opacity: 0 },
    ],
    { ...timing, fill: 'forwards' },
  )
  // The tile shows again under the ghost, which sits exactly over it, and the route
  // change then takes the sheet and the ghost away together.
  const land = () => {
    hide(tile, false)
    done()
  }
  shrink.finished.then(land, land)
  return true
}
