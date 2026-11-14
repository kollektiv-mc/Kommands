import { useEffect, useRef, useState } from 'react'
import { startScenes, type ScenePlayer } from '../../lib/scenes/player'
import { reducedMotion } from '../../lib/useMotion'
import { SCENES } from '../../data/home/scenes'
import '../../styles/scenes.css'

/**
 * The download page's scenes: app windows on the dot grid, and a tab per scene with a
 * bar that fills while it plays. A tab jumps to its scene.
 *
 * The stage is drawn by lib/scenes/player.ts, which says why; React renders the tabs.
 * The stage is decoration for assistive technology, and the tabs are plain buttons.
 */
export function Scenes() {
  const host = useRef<HTMLDivElement>(null)
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  const player = useRef<ScenePlayer | null>(null)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const node = host.current
    if (!node) return
    const reduced = reducedMotion()
    const p = startScenes(node, reduced, (i, ms) => {
      setCurrent(i)
      bars.current.forEach((bar, j) => {
        if (!bar) return
        // Under reduced motion the current tab's bar is simply full.
        bar.style.setProperty('--fill', j === i && reduced ? '1' : '0')
        if (reduced) return
        bar.getAnimations().forEach((a) => a.cancel())
        if (j !== i) return
        bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          duration: ms,
          easing: 'linear',
          fill: 'forwards',
        })
      })
    })
    player.current = p
    return () => p.stop()
  }, [])

  return (
    <div className="sc-theatre">
      <div ref={host} className="sc-stage" aria-hidden="true" />
      <div className="sc-tabs">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-current={i === current}
            onClick={() => player.current?.jump(i)}
          >
            <span>{s.label}</span>
            <span className="sc-track">
              <span
                ref={(node) => {
                  bars.current[i] = node
                }}
                className="sc-bar"
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
