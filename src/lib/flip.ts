import type { OriginRect } from '../stores/useUiStore'

/**
 * The entrance animation: a panel appears to grow out of the thing that opened it.
 *
 * FLIP — the panel is laid out at its final size, then transformed *back* onto the
 * origin rect and released. Animating the transform rather than width/height is what
 * keeps it on the compositor; animating the box would relayout the whole editor on
 * every frame of a 180ms animation.
 *
 * Deliberately off-token, and Konnekt names the same exception in its own style.css:
 * `--duration-fast` and `--duration-panel` describe UI transition roles — a hover, a
 * panel slide — and a spring-ish expand out of a tile is neither. The numbers and the
 * curve are Konnekt's, rather than a third timing nobody chose, because the two
 * products should feel the same.
 */
const IN_MS = 180
const IN_EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * The transform that puts `panel` back over `origin`.
 *
 * Measures the panel's *current* box, so the caller has to guarantee no transform is
 * on it — `getBoundingClientRect` reports the transformed rect, and measuring a panel
 * this function has already moved computes the transform that would take it from where
 * it was put back to where it was put, which is the identity. See `flipIn`.
 */
function transformOnto(panel: HTMLElement, origin: OriginRect): string {
  const rect = panel.getBoundingClientRect()
  // A zero-sized panel would divide by zero and yield a transform of NaN, which
  // silently renders nothing at all. It happens in any environment without layout —
  // jsdom, most obviously — so the guard is not hypothetical.
  if (rect.width === 0 || rect.height === 0) return ''
  const sx = origin.width / rect.width
  const sy = origin.height / rect.height
  const tx = origin.left + origin.width / 2 - (rect.left + rect.width / 2)
  const ty = origin.top + origin.height / 2 - (rect.top + rect.height / 2)
  return `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`
}

/**
 * Grow `panel` out of `origin`. Returns a cleanup for the caller's effect.
 *
 * With no origin — the editor was opened by URL, or from something off screen — this
 * still runs, as a small scale-up rather than nothing. An entrance that sometimes
 * animates and sometimes cuts reads as a glitch; one that always animates, from a
 * rect when there is one, reads as the same gesture at two levels of detail.
 */
export function flipIn(panel: HTMLElement, origin: OriginRect | null): () => void {
  if (prefersReducedMotion()) return () => {}

  // Reset before measuring, because this may be running on a panel it has already
  // transformed. React re-runs effects on the *same* DOM node — StrictMode does it on
  // every mount — and `getBoundingClientRect` reports the transformed box, so a second
  // run measured a panel already sitting on the origin, computed `scale(1, 1)`, and
  // animated nothing. Every tile-to-editor open was silently identity, and the only
  // symptom was an entrance that did not happen.
  //
  // Resetting here rather than relying on the cleanup is deliberate: it makes the
  // function correct for *any* prior state of the element, including one it did not
  // put there itself.
  panel.style.transition = 'none'
  panel.style.transform = ''
  panel.style.opacity = ''
  void panel.offsetHeight

  const from = origin ? transformOnto(panel, origin) : 'scale(0.93)'
  if (from === '') return () => {}

  panel.style.transformOrigin = 'center'
  panel.style.opacity = '0'
  panel.style.transform = from
  // Forces the style above to be committed as a starting point rather than coalesced
  // with the one below into no animation at all.
  void panel.offsetHeight
  panel.style.transition = `transform ${IN_MS}ms ${IN_EASE}, opacity ${Math.round(IN_MS * 0.78)}ms ease-out`
  panel.style.opacity = '1'
  panel.style.transform = 'translate(0px, 0px) scale(1, 1)'

  // Once it lands, strip the transform entirely rather than leaving an identity one.
  // This is not tidiness: Chromium allocates a WebGL compositing layer at the size the
  // element had when the transform was applied, so a panel left with `scale(1,1)` gets
  // a canvas sized to the flip's *starting* rect and never fills. `PreviewCanvas` is
  // exactly the kind of child that breaks on, and Konnekt hit it in its worlds tile.
  const settle = setTimeout(() => {
    panel.style.transform = ''
    panel.style.transition = ''
    panel.style.transformOrigin = ''
  }, IN_MS + 20)

  // The cleanup strips the styles as well as the timer, so an animation torn down
  // mid-flight leaves no transform behind for the next run to measure. The reset above
  // makes that belt-and-braces rather than load-bearing, which is the right way round.
  return () => {
    clearTimeout(settle)
    panel.style.transform = ''
    panel.style.transition = ''
    panel.style.transformOrigin = ''
  }
}

/**
 * Shrink `panel` back onto `origin`, then hand back to the caller.
 *
 * The exit half, added when the editor became an overlay over the dashboard rather
 * than a page that replaced it. It was written once before and deleted for being
 * unused, which was right then and is not now: an entrance with no exit reads worse
 * than neither, because the panel that grew out of a tile vanishes instead of
 * returning to it.
 *
 * `done` is what navigates. Navigating first would unmount the very element being
 * animated, so the order is fixed: animate, then leave.
 *
 * Two behaviours differ from `flipIn`, and both are deliberate:
 *
 * - **`done` is always called**, including under reduced motion and for a panel with
 *   no layout. `flipIn` can decline to animate and nothing is lost; declining here
 *   would strand the caller mid-close — Escape would do nothing at all, in every
 *   jsdom test and in any environment without layout.
 * - The backdrop fades alongside, driven from here rather than from a Tailwind
 *   arbitrary duration. That keeps every bespoke timing in this one documented file,
 *   leaves `grep -rnE '(duration|delay)-\[[0-9.]+m?s\]'` finding nothing, and keeps
 *   the JSX free of the `style={{}}` the lint rule forbids.
 */
const OUT_MS = 130
const OUT_EASE = 'cubic-bezier(0.4, 0, 1, 0.6)'
const BACKDROP_MS = 120

export function flipOut(
  panel: HTMLElement | null,
  origin: OriginRect | null,
  backdrop: HTMLElement | null,
  done: () => void,
): () => void {
  if (backdrop) {
    backdrop.style.transition = `opacity ${BACKDROP_MS}ms ease-in`
    backdrop.style.opacity = '0'
  }

  // `flipIn` stripped its transform at IN_MS + 20, so the panel measures its true box.
  const to = panel && origin ? transformOnto(panel, origin) : ''

  if (!panel || prefersReducedMotion() || to === '') {
    done()
    return () => {}
  }

  panel.style.transformOrigin = 'center'
  panel.style.transition = `transform ${OUT_MS}ms ${OUT_EASE}, opacity ${OUT_MS - 10}ms ease-in`
  panel.style.opacity = '0'
  panel.style.transform = to

  // `OUT_MS + 20`, not `OUT_MS` — the same margin `flipIn` gives its settle, and for
  // the same reason. The styles above take effect at the next style recalc, so the
  // transition starts up to a frame after this timer does; handing back at exactly
  // OUT_MS unmounts the panel with the last ~15% of its travel still to run. Measured
  // in Chromium, the collapse stopped at two thirds of the way back to the tile. The
  // fade hid most of it — opacity is nearly zero by then — but "nearly" is what makes
  // it the kind of bug that is noticed without being identified.
  const settle = setTimeout(done, OUT_MS + 20)
  return () => clearTimeout(settle)
}
