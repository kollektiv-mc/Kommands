import { useEffect, useState } from 'react'

/**
 * How long the overlay stays mounted, in milliseconds.
 *
 * Must match the `splash-overlay-fade` duration in `src/styles/index.css`. The two
 * are separate numbers because CSS drives the animation and JS drives the unmount,
 * and there is no cheap way for one to read the other — Konnekt's splash carries the
 * same pair. Unmounting *late* is harmless: the keyframe ends at `opacity: 0` with
 * `forwards`, so an over-long timer holds an invisible element. Unmounting *early*
 * cuts the fade off mid-way, which is the direction to keep an eye on if either
 * number changes.
 *
 * Deliberately off-token. `--duration-fast` and `--duration-panel` name UI transition
 * roles — a hover, a panel slide — and a one-second startup title is neither. Konnekt
 * makes the same call, in the same words, for its flash ring.
 */
const SPLASH_MS = 1000

/** Whether the viewer has asked for less motion. Absent `matchMedia` reads as "no". */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * The product's name, once, over the canvas, then gone.
 *
 * Modelled on Konnekt's `SplashScreen` so the two products open the same way — the
 * accent-coloured display face, the same one-second fade — with the accent itself
 * being what tells them apart (ember here, green there; see `src/lib/theme.ts`).
 *
 * `aria-hidden` and `pointer-events: none`, so it is decoration in both trees: it
 * never takes focus, never announces itself, and never swallows a click aimed at the
 * app underneath. That matters more here than it does in Konnekt, because this
 * overlay covers a page that is already interactive rather than an app still starting.
 *
 * Which is also why reduced motion skips it entirely rather than showing it without
 * the animation. There is no startup work to mask, so the honest answer to "less
 * motion" is to go straight to the app.
 *
 * Styled by class rather than by utility. The two rules it needs — a fullscreen
 * overlay and a clamped display size well above the 20px top of the shared type scale
 * — are a one-off decorative sequence rather than anything the token layer names, and
 * `src/styles/index.css` is where this repo already keeps hand-written CSS.
 */
export function SplashScreen() {
  const [done, setDone] = useState(prefersReducedMotion)

  useEffect(() => {
    if (done) return
    const timer = setTimeout(() => setDone(true), SPLASH_MS)
    return () => clearTimeout(timer)
  }, [done])

  if (done) return null

  return (
    <div className="splash-overlay" aria-hidden="true">
      <span className="splash-word">Kommands</span>
    </div>
  )
}
