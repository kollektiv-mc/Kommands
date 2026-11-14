/**
 * The small icons the scene windows draw, in currentColor, and the Kommands mark for
 * the Kommands window's title bar.
 */
import { icon, shape, stroke } from '../hero/dom'
import { MARK } from '../splashMark'
import { currentTheme, MARK_SHADES } from '../theme'

const round = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }

export const linkIcon = () =>
  icon(10, '0 0 12 12', (s) =>
    shape(s, 'path', {
      d: 'M5 7l2-2M4.2 5.6 3 6.8a1.8 1.8 0 0 0 2.5 2.5L6.7 8.1M7.8 6.4 9 5.2A1.8 1.8 0 0 0 6.5 2.7L5.3 3.9',
      ...stroke('1.3'),
      ...round,
    }),
  )

export const pinIcon = () =>
  icon(10, '0 0 12 12', (s) =>
    shape(s, 'path', { d: 'M4 1.5h4M5 1.5v3L3 7h6L7 4.5v-3M6 7v3.5', ...stroke('1.2'), ...round }),
  )

export const editIcon = () =>
  icon(10, '0 0 12 12', (s) =>
    shape(s, 'path', {
      d: 'M2 10l.5-2.3L8 2.2 9.8 4 4.3 9.5zM7 3.2 8.8 5',
      ...stroke('1.2'),
      ...round,
    }),
  )

export const searchIcon = () =>
  icon(9, '0 0 10 10', (s) => {
    shape(s, 'circle', { cx: '4.2', cy: '4.2', r: '3', ...stroke('1.3') })
    shape(s, 'path', { d: 'M6.4 6.4 9 9', ...stroke('1.3') })
  })

export const copyIcon = () =>
  icon(11, '0 0 12 12', (s) => {
    shape(s, 'rect', { x: '3.5', y: '3.5', width: '7', height: '7', rx: '1.2', ...stroke('1.3') })
    shape(s, 'path', {
      d: 'M8 3.5V2.2A.7.7 0 0 0 7.3 1.5H2.2a.7.7 0 0 0-.7.7v5.1a.7.7 0 0 0 .7.7h1.3',
      ...stroke('1.3'),
    })
  })

export const gearIcon = () =>
  icon(12, '0 0 12 12', (s) => {
    shape(s, 'circle', { cx: '6', cy: '6', r: '2', ...stroke('1.2') })
    shape(s, 'circle', {
      cx: '6',
      cy: '6',
      r: '4.6',
      ...stroke('1.2'),
      'stroke-dasharray': '2 1.6',
    })
  })

/** The mark at rest, as `BrandMark` draws it, for a window built outside React. */
export function markIcon(): SVGSVGElement {
  const shades = MARK_SHADES[currentTheme()]
  const pts = (p: readonly (readonly [number, number])[]) => p.join(' ')
  return icon(15, '0 0 24 24', (s) => {
    shape(s, 'polygon', { points: pts(MARK.bracketLeft), fill: shades.top })
    shape(s, 'polygon', { points: pts(MARK.bracketRight), fill: shades.top })
    shape(s, 'polygon', { points: pts(MARK.top), fill: shades.top })
    shape(s, 'polygon', { points: pts(MARK.left), fill: shades.left })
    shape(s, 'polygon', { points: pts(MARK.right), fill: shades.right })
    shape(s, 'polygon', { points: pts(MARK.prompt), class: 'fill-canvas' })
  })
}
