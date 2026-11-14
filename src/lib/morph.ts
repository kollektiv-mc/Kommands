import { motionTiming, reducedMotion } from './useMotion'

/**
 * The editor opening out of the tile that opened it, and closing back into it.
 *
 * A container transform rather than a FLIP of a finished sheet: what moves reads as the
 * tile's own surface growing into the editor, with the tile's content handed over to
 * the editor's on the way. `flipIn` scaled the sheet down onto the tile and faded it in,
 * which read as a box appearing over the tile; it stays the fallback where there is no
 * tile to grow from.
 *
 * Only `transform` and `opacity` move, so the compositor plays it on its own while the
 * editor's route is still mounting on the main thread. The first version laid a box out
 * at every size and clipped the sheet with `clip-path`, both main-thread work, and
 * dropped frames exactly while the editor mounted.
 *
 * - **The sheet** is scaled from the tile's box to its own, from its top-left corner.
 * - **Its body** and **a copy of the tile** inside it are scaled back by the inverse at
 *   every frame, so both stay at their own size while the sheet around them grows. The
 *   copy fades out over the first third, then the body fades in.
 *
 * The inverse of a scale is not linear in time, so the frames are sampled here, eased
 * here, and played on a linear timing: the sheet and what is inside it then agree at
 * every sample, and in between by less than a pixel.
 *
 * The tile on the dashboard is hidden while the editor stands for it, so there are never
 * two of it on screen, and shows again once the editor has shrunk back into it or gone.
 */

/** How much of the motion the copy of the tile takes to fade, and the body waits. */
const HANDOVER = 0.35
/** Closing is the same gesture, a little quicker, as an exit usually is. */
const CLOSE_SCALE = 0.85
/** Frames sampled per motion: enough that the inverse scale never visibly drifts. */
const SAMPLES = 24

interface Parts {
  /** The sheet, at its final place and size. */
  panel: HTMLElement
  /** What the sheet holds, laid out at the sheet's size: counter-scaled while it moves. */
  body: HTMLElement
  /** The tile it grows from or shrinks into. */
  tile: HTMLElement
}

/** `cubic-bezier(x1, y1, x2, y2)` as a function of progress, as CSS solves it. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  return (x: number) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1
    // Bisection on x(t): monotonic for any x1, x2 in [0, 1], and exact enough in 20.
    let lo = 0
    let hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

const KEYWORDS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  linear: [0, 0, 1, 1],
}

/** The token's easing as a function, which the sampled frames are eased by. */
export function easingOf(css: string): (x: number) => number {
  const numbers = /^cubic-bezier\(([^)]*)\)$/.exec(css.trim())?.[1]?.split(',').map(Number)
  const points = numbers?.length === 4 && numbers.every(Number.isFinite) ? numbers : KEYWORDS[css]
  const [x1, y1, x2, y2] = points ?? KEYWORDS['ease-in-out']!
  return bezier(x1!, y1!, x2!, y2!)
}

interface Motion {
  /** The sheet's scale and offset at the tile: where the motion starts or ends. */
  sx: number
  sy: number
  dx: number
  dy: number
}

/** The sheet's box against the tile's, or null when either has none to measure. */
function measure(panel: HTMLElement, tile: HTMLElement): Motion | null {
  const to = panel.getBoundingClientRect()
  const from = tile.getBoundingClientRect()
  if (from.width === 0 || from.height === 0 || to.width === 0 || to.height === 0) return null
  return {
    sx: from.width / to.width,
    sy: from.height / to.height,
    dx: from.left - to.left,
    dy: from.top - to.top,
  }
}

const fade = (from: number, to: number, x: number) =>
  Math.min(1, Math.max(0, (x - from) / (to - from)))

/**
 * The three layers' frames, from the tile (`at` 0) to the sheet (`at` 1), for progress
 * `x` in time. `grow` is false when closing, which plays the handover at halfway: the
 * copy cannot arrive while the sheet is still much bigger than it.
 */
function frames(m: Motion, ease: (x: number) => number, grow: boolean) {
  const panel: Keyframe[] = []
  const body: Keyframe[] = []
  const copy: Keyframe[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    // How far from the tile towards the sheet, whichever way it plays.
    const at = grow ? ease(t) : 1 - ease(t)
    const sx = m.sx + (1 - m.sx) * at
    const sy = m.sy + (1 - m.sy) * at
    const inverse = `scale(${1 / sx}, ${1 / sy})`
    const shown = grow ? fade(HANDOVER, 1, t) : 1 - fade(0, 0.5, t)
    const kept = grow ? 1 - fade(0, HANDOVER, t) : fade(0.5, 1, t)
    panel.push({
      transform: `translate(${m.dx * (1 - at)}px, ${m.dy * (1 - at)}px) scale(${sx}, ${sy})`,
    })
    body.push({ transform: inverse, opacity: shown })
    copy.push({ transform: inverse, opacity: kept })
  }
  return { panel, body, copy }
}

/** The tile, drawn inside the sheet's top-left corner at its own size. */
function copyOf(tile: HTMLElement, panel: HTMLElement) {
  const box = tile.getBoundingClientRect()
  const copy = tile.cloneNode(true) as HTMLElement
  for (const name of ['id', 'data-origin', 'data-saved-id']) copy.removeAttribute(name)
  copy.setAttribute('aria-hidden', 'true')
  copy.inert = true
  Object.assign(copy.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: '0',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    // The tile is hidden by now, inline, and a clone copies that.
    visibility: '',
    transition: '',
  })
  panel.append(copy)
  return copy
}

/**
 * Sets the sheet up to be scaled from its corner, clipped to its own box with its
 * surface's corners, or puts it back. Clipped so the counter-scaled body, at its full
 * size inside a sheet the size of the tile, shows only as much as the tile's box.
 */
function stage({ panel, body }: Parts, on: boolean) {
  const radius = on
    ? (panel.firstElementChild && getComputedStyle(panel.firstElementChild).borderTopLeftRadius) ||
      ''
    : ''
  Object.assign(panel.style, {
    transformOrigin: on ? '0 0' : '',
    overflow: on ? 'hidden' : '',
    borderRadius: radius,
  })
  body.style.transformOrigin = on ? '0 0' : ''
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
 * Hides the tile while the editor stands for it, or shows it again. With its transition
 * off: a tile transitions `all`, and visibility is held visible for the whole of a
 * transition to hidden, which left the tile on screen beside the editor.
 */
export function hideTile(tile: HTMLElement, hidden: boolean) {
  tile.style.transition = hidden ? 'none' : ''
  tile.style.visibility = hidden ? 'hidden' : ''
}

const canAnimate = (parts: Parts) => !reducedMotion() && typeof parts.panel.animate === 'function'

/**
 * Grow the sheet out of `tile`, and leave the tile hidden behind it. Returns what shows
 * the tile again, for the caller to run when the editor stops standing for it, or null
 * when there is nothing to grow from (no layout, reduced motion), for the caller to
 * fall back.
 */
export function morphIn(parts: Parts, backdrop: HTMLElement | null): (() => void) | null {
  if (!canAnimate(parts)) return null
  const { panel, body, tile } = parts
  const m = measure(panel, tile)
  if (!m) return null
  const { duration, easing } = motionTiming()
  const steps = frames(m, easingOf(easing), true)

  hideTile(tile, true)
  stage(parts, true)
  const copy = copyOf(tile, panel)
  fadeBackdrop(backdrop, true, duration)
  const timing = { duration, easing: 'linear' }
  const running = [
    panel.animate(steps.panel, timing),
    body.animate(steps.body, timing),
    copy.animate(steps.copy, timing),
  ]
  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    for (const animation of running) animation.cancel()
    copy.remove()
    stage(parts, false)
    if (backdrop) backdrop.style.transition = ''
  }
  running[0]!.finished.then(end, () => undefined)
  return () => {
    end()
    hideTile(tile, false)
  }
}

/**
 * Shrink the sheet back into `tile`, then show the tile and call `done`, which
 * navigates away. Returns false when it cannot run, and then calls nothing, for the
 * caller's fallback.
 */
export function morphOut(parts: Parts, backdrop: HTMLElement | null, done: () => void): boolean {
  if (!canAnimate(parts)) return false
  const { panel, body, tile } = parts
  const m = measure(panel, tile)
  if (!m) return false
  const motion = motionTiming()
  const duration = Math.round(motion.duration * CLOSE_SCALE)
  const steps = frames(m, easingOf(motion.easing), false)

  hideTile(tile, true)
  stage(parts, true)
  const copy = copyOf(tile, panel)
  fadeBackdrop(backdrop, false, duration)
  const timing: KeyframeAnimationOptions = { duration, easing: 'linear', fill: 'forwards' }
  const shrink = panel.animate(steps.panel, timing)
  body.animate(steps.body, timing)
  copy.animate(steps.copy, timing)
  // The copy sits exactly over the tile by now, and the route change takes the sheet
  // and the copy away together.
  const land = () => {
    hideTile(tile, false)
    done()
  }
  shrink.finished.then(land, land)
  return true
}
