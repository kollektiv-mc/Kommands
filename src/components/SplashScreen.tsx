import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { currentTheme, MARK_SHADES } from '../lib/theme'
import { reducedMotion } from '../lib/useMotion'
import {
  extrude,
  FACE_ORIGIN,
  MARK,
  type Point,
  RESTING_FRAME,
  SPLASH_MS,
  splashClock,
  splashFrame,
} from '../lib/splashMark'

// A point list stringifies as `x,y,x,y`, which SVG's points attribute reads.
const pts = (p: readonly Point[]) => p.join(' ')

/**
 * The mark builds itself over the canvas, then the overlay fades and this unmounts.
 *
 * The prompt shows alone, flashes twice and goes, the left face fills in where it was,
 * the face extrudes back into the block, and the brackets close in. The timeline is
 * `lib/splashMark.ts`, run on its clock, which waits out the dashboard's first render
 * before starting. Konnekt's splash works the same way with its own mark.
 *
 * Each frame is committed inside its own animation frame callback with `flushSync`.
 * Left to React's scheduler it would render in a task queued behind whatever the
 * dashboard has queued, and paint a frame late whenever that work ran long.
 *
 * The prompt is drawn in the canvas colour rather than masked, which is the same on
 * the solid overlay and lets it be cut only where its face has filled in.
 *
 * `aria-hidden` and `pointer-events: none` (index.css): decoration in both trees. Under
 * reduced motion the finished mark shows still and fades, as Konnekt's does.
 */
export function SplashScreen() {
  const [still] = useState(reducedMotion)
  const [shades] = useState(() => MARK_SHADES[currentTheme()])
  const [ms, setMs] = useState(0)
  const [fading, setFading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const finish = () => setDone(true)
    if (still) {
      const end = setTimeout(finish, SPLASH_MS.still)
      return () => clearTimeout(end)
    }
    let raf = 0
    let end: ReturnType<typeof setTimeout> | undefined
    const clock = splashClock()
    const tick = (now: number) => {
      const elapsed = clock(now)
      if (elapsed >= SPLASH_MS.fadeStart) {
        setFading(true)
        end = setTimeout(finish, SPLASH_MS.fade)
        return
      }
      if (elapsed >= 0) flushSync(() => setMs(elapsed))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      clearTimeout(end)
      cancelAnimationFrame(raf)
    }
  }, [still])

  if (done) return null

  const frame = still ? RESTING_FRAME : splashFrame(ms)
  const block = extrude(frame.depth)
  const shift = frame.bracketShift

  return (
    <div
      className={
        still
          ? 'splash-overlay splash-still'
          : fading
            ? 'splash-overlay splash-fading'
            : 'splash-overlay'
      }
      aria-hidden="true"
    >
      <svg className="splash-mark" viewBox="0 0 24 24">
        <defs>
          <clipPath id="splash-face">
            <circle cx={FACE_ORIGIN[0]} cy={FACE_ORIGIN[1]} r={frame.faceRadius} />
          </clipPath>
        </defs>
        <polygon points={pts(MARK.prompt)} fill={shades.left} opacity={frame.promptOpacity} />
        {frame.depth > 0 ? (
          <g data-part="extrusion">
            <polygon points={pts(block.base)} fill={shades.left} />
            <polygon points={pts(block.right)} fill={shades.right} />
            <polygon points={pts(block.top)} fill={shades.top} />
          </g>
        ) : null}
        {frame.faceRadius > 0 ? (
          <g clipPath="url(#splash-face)" data-part="face">
            <polygon points={pts(MARK.left)} fill={shades.left} />
            <polygon points={pts(MARK.prompt)} className="fill-canvas" />
          </g>
        ) : null}
        <g opacity={frame.bracketOpacity} fill={shades.top} data-part="brackets">
          <polygon points={pts(MARK.bracketLeft)} transform={`translate(${-shift} 0)`} />
          <polygon points={pts(MARK.bracketRight)} transform={`translate(${shift} 0)`} />
        </g>
      </svg>
    </div>
  )
}
