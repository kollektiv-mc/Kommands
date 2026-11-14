import { durationMs } from './motion'
import { motionTiming, reducedMotion } from './useMotion'

/**
 * A full-screen editor opening out of the preview it was opened from, and closing back
 * into it. `docs/generate-editor.md` § What the prototype settled describes it.
 *
 * The editor's view fills its whole area, with the header and the tiles over it.
 * Opening: a picture of the preview grows from its tile to fill that area, scaled
 * evenly and cropped to the tile's shape on the way, so it is never squeezed. The
 * header and the tiles then slide in over it from their own edges, and the live view
 * takes its place underneath them. Closing runs it backwards with a picture of the
 * view: the tiles slide out, and the picture shrinks into the tile while the sheet
 * comes back around it.
 *
 * Transform and opacity, plus the crop, which is a `clip-path` because a scaled
 * picture has to lose its edges somehow. Under reduced motion neither half animates:
 * the editor appears, and Done returns at once. The durations are the panel token's,
 * scaled as the prototype scaled them, so a retime of the suite reaches this too.
 */
export interface EditorParts {
  /** The whole editor, whose box the picture fills. */
  root: HTMLElement
  /** The live view, filling the root under everything else, and opaque. */
  stage: HTMLElement
  /** An image filling the root, over the view and under the tiles. Hidden when unused. */
  picture: HTMLImageElement
  /** The gap between the tiles, with the view's controls in it. */
  opening: HTMLElement
  /** What slides, in order: the header, left, bottom and right. */
  header: HTMLElement
  left: HTMLElement
  bottom: HTMLElement
  right: HTMLElement
}

export interface EditorOrigin {
  /** Where the preview is on screen. */
  rect: DOMRect
  /** A picture of it, or null when there is none to take. */
  picture: string | null
}

const STAGGER = 40

/** Where a preview is, with a picture of its canvas when it has one on screen. */
export function originOf(box: HTMLElement): EditorOrigin {
  return { rect: box.getBoundingClientRect(), picture: pictureOf(box) }
}
/** A picture of what a canvas inside `el` shows, or null when there is none to take. */
export function pictureOf(el: HTMLElement): string | null {
  const canvas = el.querySelector('canvas')
  if (canvas === null || canvas.width === 0 || canvas.height === 0) return null
  try {
    return canvas.toDataURL()
  } catch {
    return null
  }
}

/** Opens the editor out of `origin`. Returns a function that stops it where it is. */
export function openEditor(parts: EditorParts, origin: EditorOrigin | null): () => void {
  if (origin === null || origin.picture === null || !animates(parts.root)) return () => {}
  const { grow, slide, fast, easing } = timing()
  const panes = slides(parts)
  const end = grow + slide + STAGGER * (panes.length - 1)
  const hold = { fill: 'backwards' } as const
  show(parts.picture, origin.picture)
  const running = [
    parts.picture.animate([cropTo(parts.root, origin.rect), FULL], {
      duration: grow,
      easing,
      fill: 'forwards',
    }),
    ...panes.map(([el, away], i) =>
      el.animate(
        [
          { transform: away, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: slide, delay: grow + i * STAGGER, easing: 'ease-out', ...hold },
      ),
    ),
    // Under the picture, so it shows once the picture goes, which it then does.
    fade(parts.stage, 0, 1, { duration: fast, delay: end, easing, ...hold }),
    fade(parts.opening, 0, 1, { duration: fast, delay: end, easing, ...hold }),
  ]
  const leave = fade(parts.picture, 1, 0, { duration: fast, delay: end + fast, easing })
  running.push(leave)
  // Only once it has run out: a cancelled run settles too, a microtask later, by when
  // a fresh run (an effect run twice, in development) may have shown the picture again.
  leave.finished.then(
    () => hide(parts.picture),
    () => undefined,
  )
  return () => {
    running.forEach((a) => a.cancel())
    hide(parts.picture)
  }
}

/**
 * Closes the editor into `target`, with `picture` of the view, then calls `done`: at
 * once when there is no motion, or nothing to close into.
 */
export function closeEditor(
  parts: EditorParts,
  picture: string | null,
  target: () => DOMRect | null,
  done: () => void,
): void {
  if (picture === null || !animates(parts.root)) {
    done()
    return
  }
  const { grow, slide, fast, easing } = timing()
  const panes = slides(parts)
  const out = slide + STAGGER * (panes.length - 1)
  const keep = { fill: 'forwards' } as const
  // The picture covers the view from here on, so the view goes under it unseen, and
  // only the controls in the opening visibly fade.
  show(parts.picture, picture)
  fade(parts.stage, 1, 0, { duration: fast, easing, ...keep })
  fade(parts.opening, 1, 0, { duration: fast, easing, ...keep })
  panes.forEach(([el, away], i) =>
    el.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: away, opacity: 0 },
      ],
      { duration: slide, delay: (panes.length - 1 - i) * STAGGER, easing: 'ease-in', ...keep },
    ),
  )
  const settle = () => {
    const to = target()
    if (to === null) {
      done()
      return
    }
    // The sheet shows round the picture as it shrinks onto the tile it came from.
    parts.picture
      .animate([FULL, cropTo(parts.root, to)], { duration: grow, easing, ...keep })
      .finished.then(done, done)
  }
  window.setTimeout(settle, out)
}

const FULL: Keyframe = { transform: 'none', clipPath: 'inset(0px 0px)' }

/**
 * The picture, scaled evenly about its top left corner so its box covers `rect`, and
 * cropped to `rect`. `root` is the box the picture fills when it is not scaled.
 */
function cropTo(root: HTMLElement, rect: DOMRect): Keyframe {
  const box = root.getBoundingClientRect()
  const { width: w, height: h } = box
  if (w === 0 || h === 0) return FULL
  const k = Math.max(rect.width / w, rect.height / h)
  const x = rect.left - box.left + (rect.width - w * k) / 2
  const y = rect.top - box.top + (rect.height - h * k) / 2
  const insetY = (h - rect.height / k) / 2
  const insetX = (w - rect.width / k) / 2
  return {
    transform: `translate(${x}px, ${y}px) scale(${k})`,
    clipPath: `inset(${insetY}px ${insetX}px)`,
  }
}

function timing() {
  const panel = durationMs('--duration-panel', 280)
  return {
    grow: Math.round(panel * 1.5),
    slide: Math.round(panel * 1.25),
    fast: durationMs('--duration-fast', 150),
    easing: motionTiming().easing,
  }
}

/** Each part that slides, and where from: past its own edge of the window, plus a gap. */
function slides(parts: EditorParts): ReadonlyArray<readonly [HTMLElement, string]> {
  const gap = 'var(--spacing) * 6'
  return [
    [parts.header, `translateY(calc(-100% - ${gap}))`],
    [parts.left, `translateX(calc(-100% - ${gap}))`],
    [parts.bottom, `translateY(calc(100% + ${gap}))`],
    [parts.right, `translateX(calc(100% + ${gap}))`],
  ]
}

function show(img: HTMLImageElement, src: string) {
  img.src = src
  img.hidden = false
}

function hide(img: HTMLImageElement) {
  img.hidden = true
  img.removeAttribute('src')
}

function fade(el: HTMLElement, from: number, to: number, options: KeyframeAnimationOptions) {
  return el.animate([{ opacity: from }, { opacity: to }], options)
}

/** Web Animations exist (not in jsdom) and the user has not asked for less motion. */
function animates(el: HTMLElement): boolean {
  return typeof el.animate === 'function' && !reducedMotion()
}
