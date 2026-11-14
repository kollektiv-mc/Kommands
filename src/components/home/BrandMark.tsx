import { useState } from 'react'
import { MARK, type Point } from '../../lib/splashMark'
import { currentTheme, MARK_SHADES } from '../../lib/theme'

const pts = (p: readonly Point[]) => p.join(' ')

/**
 * The Kommands mark at rest (docs/brand/mark-on-dark.svg), from the splash's geometry.
 *
 * The prompt is drawn in the canvas colour over the left face rather than masked out
 * of it, as the splash draws it, which is the same on any ground this sits on.
 */
export function BrandMark({ className }: { className?: string }) {
  const [shades] = useState(() => MARK_SHADES[currentTheme()])
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={pts(MARK.bracketLeft)} fill={shades.top} />
      <polygon points={pts(MARK.bracketRight)} fill={shades.top} />
      <polygon points={pts(MARK.top)} fill={shades.top} />
      <polygon points={pts(MARK.left)} fill={shades.left} />
      <polygon points={pts(MARK.right)} fill={shades.right} />
      <polygon points={pts(MARK.prompt)} className="fill-canvas" />
    </svg>
  )
}
