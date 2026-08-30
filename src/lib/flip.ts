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
