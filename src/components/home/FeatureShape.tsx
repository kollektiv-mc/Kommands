import { useEffect, useRef } from 'react'
import { drawBlocks, fitCanvas, hexRgb, voxelise } from '../../lib/hero/voxels'
import { reducedMotion } from '../../lib/useMotion'
import { FEATURE_SHAPE } from '../../data/home/site'

/** The 3D Editor tile's visual: a `//generate` structure turning slowly. Still under reduced motion. */
export function FeatureShape() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g) return
    const { n } = FEATURE_SHAPE
    const colour = hexRgb(FEATURE_SHAPE.colour)
    const blocks = voxelise(FEATURE_SHAPE.field, n).map((p) => ({
      p: [p[0], p[1] - n / 2, p[2]] as const,
      c: colour,
    }))
    let yaw = 0.6
    let frame = 0
    let last = 0
    const draw = () => {
      const { w, h } = fitCanvas(cv)
      g.clearRect(0, 0, w, h)
      drawBlocks(g, blocks, { yaw, pitch: 0.5, s: Math.min(w, h) / 22, cx: w / 2, cy: h / 2 })
    }
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (last) yaw += (now - last) * 0.00035
      last = now
      draw()
    }
    draw()
    if (!reducedMotion()) frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} aria-hidden="true" />
}
