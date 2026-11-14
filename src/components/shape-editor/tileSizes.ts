/**
 * The editor's tiles, resized by dragging the gaps between them (`TileHandles.tsx`).
 *
 * A size left `null` is the one the layout gives at this window size, so a tile nobody
 * has dragged still follows the window. Kept for the session the editor is open.
 */
export interface TileSizes {
  /** The Shapes tile's width, the inspector's, and the command box's height. */
  left: number | null
  right: number | null
  command: number | null
}

export const DEFAULT_SIZES: TileSizes = { left: null, right: null, command: null }

/** A gap between two tiles, or a corner where two gaps meet. */
export type Handle = 'left' | 'right' | 'bottom' | 'left-bottom' | 'right-bottom'

/** The sizes as they were when a drag began. */
export interface Measured {
  left: number
  right: number
  viewWidth: number
  viewHeight: number
  command: number
}

/** Narrowest each side tile goes, and the narrowest and shortest the view does. */
const MIN = { left: 180, right: 220, view: 440, viewHeight: 300 }

/**
 * The command box grows a whole line at a time, so no line is ever cut in half: its
 * text is `text-xs leading-normal`, under `pt-1.5` and over the `h-6` status row.
 */
const LINE = 18
const CHROME = 30
const MIN_LINES = 2

const clamp = (n: number, lo: number, hi: number) =>
  Math.round(Math.min(Math.max(n, lo), Math.max(lo, hi)))

/** The sizes after dragging `handle` by `dx`, `dy` from where it was pressed. */
export function dragTiles(
  sizes: TileSizes,
  handle: Handle,
  from: Measured,
  dx: number,
  dy: number,
): TileSizes {
  const next = { ...sizes }
  if (handle.startsWith('left')) {
    next.left = clamp(from.left + dx, MIN.left, from.left + from.viewWidth - MIN.view)
  }
  if (handle.startsWith('right')) {
    next.right = clamp(from.right - dx, MIN.right, from.right + from.viewWidth - MIN.view)
  }
  if (handle.endsWith('bottom')) {
    const tall = clamp(
      from.command - dy,
      CHROME + LINE * MIN_LINES,
      from.command + from.viewHeight - MIN.viewHeight,
    )
    next.command = CHROME + LINE * Math.max(MIN_LINES, Math.round((tall - CHROME) / LINE))
  }
  return next
}

/** A double-click on a handle puts back the sizes it moves. */
export function resetTiles(sizes: TileSizes, handle: Handle): TileSizes {
  const next = { ...sizes }
  if (handle.startsWith('left')) next.left = null
  if (handle.startsWith('right')) next.right = null
  if (handle.endsWith('bottom')) next.command = null
  return next
}
