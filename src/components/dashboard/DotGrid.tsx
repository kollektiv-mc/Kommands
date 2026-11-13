import { useEffect, useRef } from 'react'
import { dotLevel } from '../../lib/noise'

/** Grid pitch, dot radius at rest, and the dots' opacity, in CSS pixels and alpha. */
const SPACING = 22
const RADIUS = 1.6
const ALPHA = 0.035
const FPS = 30

/**
 * The dashboard's background: a faint dot grid whose dots swell and settle in slow,
 * uneven waves driven by Perlin noise.
 *
 * Drawn on a canvas in the primary text colour, read from the element's own `color`, so
 * it follows the theme. Still under reduced motion, and paused while the tab is hidden,
 * since `requestAnimationFrame` does not run then.
 *
 * Also paused while something covers the dashboard (`paused`): redrawing the whole
 * window thirty times a second under the editor's dim is invisible, and measured as a
 * large share of each frame the editor's own motion needed.
 */
export function DotGrid({ paused = false }: { paused?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let width = 0
    let height = 0
    // Now, not zero, so the frame drawn on pausing is the one the animation had reached.
    let seconds = performance.now() / 1000
    let frame = 0
    let last = 0

    // Read about once a second rather than every frame: a computed style read every
    // frame is a style recalculation every frame, and a theme change can wait a second.
    let ink = ''
    let drawn = 0
    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      if (drawn++ % FPS === 0) ink = getComputedStyle(canvas).color
      ctx.fillStyle = ink
      const cols = Math.ceil(width / SPACING)
      const rows = Math.ceil(height / SPACING)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const level = still ? 0.5 : dotLevel(c, r, seconds)
          ctx.globalAlpha = ALPHA * (0.7 + 0.6 * level)
          ctx.beginPath()
          ctx.arc(
            c * SPACING + SPACING / 2,
            r * SPACING + SPACING / 2,
            RADIUS * (0.45 + 1.1 * level),
            0,
            Math.PI * 2,
          )
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawn = 0
      draw()
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 1000 / FPS) return
      last = now
      seconds = now / 1000
      draw()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    if (!still && !paused) frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [paused])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="text-text-primary pointer-events-none absolute inset-0 size-full"
    />
  )
}
