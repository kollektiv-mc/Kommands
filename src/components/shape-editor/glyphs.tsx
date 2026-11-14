import type { ReactNode } from 'react'
import type { ModifierKind, ShapeKind } from '../../worldedit/stack/layers'

/**
 * The shape editor's own glyphs: one per shape, modifier and tool.
 *
 * Drawn on an 18-unit grid rather than `lib/icons.tsx`'s lucide paths, because a shape
 * reads as a solid only with a second, fainter stroke behind the first (the far side of
 * a box, the inner ring of a torus), and that takes several elements and an opacity,
 * which a single path string cannot carry.
 */
export type GlyphName = ShapeKind | ModifierKind | 'reference' | 'group'

const FAINT = 0.55

const GLYPHS: Readonly<Record<GlyphName, ReactNode>> = {
  sphere: (
    <>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M2.5 9c0 1.8 2.9 3.2 6.5 3.2s6.5-1.4 6.5-3.2" opacity={FAINT} />
    </>
  ),
  box: (
    <>
      <path d="M9 2.5 15 5.5v7L9 15.5 3 12.5v-7z" />
      <path d="M3 5.5 9 8.5l6-3M9 8.5v7" opacity={FAINT} />
    </>
  ),
  cylinder: (
    <>
      <ellipse cx="9" cy="4.5" rx="5.5" ry="2" />
      <path d="M3.5 4.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" />
    </>
  ),
  torus: (
    <>
      <ellipse cx="9" cy="9" rx="7" ry="4" />
      <ellipse cx="9" cy="8.6" rx="2.8" ry="1.3" opacity={0.7} />
    </>
  ),
  half: (
    <>
      <path d="M2 9.5h14" />
      <path d="M4 12l2-2.5M7.5 12l2-2.5M11 12l2-2.5M14.5 12l1-1.3" opacity={FAINT} />
      <path d="M9 3v4M7.3 5.4 9 7l1.7-1.6" opacity={0.8} />
    </>
  ),
  gyroid: <path d="M2 6c2.3-3 4.7 3 7 0s4.7 3 7 0M2 12c2.3-3 4.7 3 7 0s4.7 3 7 0" />,
  formula: <path d="M11.5 2.5c-2 0-2.5 1-2.8 3L7.3 13c-.3 1.8-1 2.5-2.8 2.5M5.5 7h6" />,
  triangle: <path d="M9 3 15.5 14.5h-13z" />,
  cone: (
    <>
      <path d="M9 2.5 14.5 13.5M9 2.5 3.5 13.5" />
      <ellipse cx="9" cy="13.5" rx="5.5" ry="2" />
    </>
  ),
  mirror: (
    <>
      <path d="M9 2v14" strokeDasharray="2 2" />
      <path d="M6.5 5 2.5 9l4 4zM11.5 5l4 4-4 4z" />
    </>
  ),
  distort: <path d="M5 2.5c3 2.5-3 5.5 0 8s-3 5 0 5M13 2.5c3 2.5-3 5.5 0 8s-3 5 0 5" />,
  array: (
    <>
      <rect x="2" y="6.5" width="4" height="5" rx=".6" />
      <rect x="7" y="6.5" width="4" height="5" rx=".6" opacity={0.7} />
      <rect x="12" y="6.5" width="4" height="5" rx=".6" opacity={0.45} />
    </>
  ),
  radial: (
    <>
      <circle cx="9" cy="9" r="1.4" />
      <path d="M9 2.5v3.5M9 12v3.5M2.5 9H6M12 9h3.5M4.4 4.4l2.4 2.4M11.2 11.2l2.4 2.4M13.6 4.4l-2.4 2.4M6.8 11.2l-2.4 2.4" />
    </>
  ),
  bend: (
    <>
      <path d="M2.5 13.5C2.5 7 6 4 9 4s6.5 3 6.5 9.5" />
      <path d="M5.5 13.5c0-4 1.5-6.5 3.5-6.5s3.5 2.5 3.5 6.5" opacity={FAINT} />
    </>
  ),
  taper: <path d="M6.5 3h5L15 15H3z" />,
  revolve: (
    <>
      <path d="M9 2v14" strokeDasharray="2 2" />
      <ellipse cx="9" cy="10" rx="6.5" ry="2.5" />
      <path d="M13.5 5.5 15.5 8l-2.8.6" />
    </>
  ),
  reference: (
    <>
      <path d="M9 2.5 15 5.5v7L9 15.5 3 12.5v-7z" strokeDasharray="2 1.6" />
      <path d="M3 5.5 9 8.5l6-3M9 8.5v7" opacity={0.5} />
    </>
  ),
  group: (
    <path d="M2.5 5.5a1 1 0 0 1 1-1h3.2l1.5 1.5h6.3a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
  ),
}

/** Stroke weight in screen pixels, the same one `ui/Icon.tsx` draws at. */
const STROKE_PX = 1.25

const SIZE = {
  sm: { cls: 'size-3.5', px: 14 },
  md: { cls: 'size-4', px: 16 },
  lg: { cls: 'size-4.5', px: 18 },
} as const

export function Glyph({
  name,
  size = 'md',
  className = '',
}: {
  name: GlyphName
  size?: keyof typeof SIZE
  className?: string
}) {
  const { cls, px } = SIZE[size]
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={(STROKE_PX * 18) / px}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={`${cls} shrink-0 ${className}`}
    >
      {GLYPHS[name]}
    </svg>
  )
}
