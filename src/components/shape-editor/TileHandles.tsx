import type { KeyboardEvent, PointerEvent } from 'react'
import { dragTiles, resetTiles, type Handle, type Measured, type TileSizes } from './tileSizes'

/**
 * The gaps around the view, which resize the tiles either side: the Shapes tile and the
 * inspector sideways, the command box up and down, and a corner both at once. A
 * double-click on one puts back what it moves.
 *
 * Inside the view's opening and hung out over its gutters, so they are exactly the gaps.
 * They take the pointer there, which elsewhere in a gutter turns the camera. Focused,
 * the arrow keys move them a step at a time.
 */

/** How far an arrow key moves a gap: a little sideways, one command line up or down. */
const KEY_STEP = { x: 16, y: 18 }
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}
/** A gap shows a line on hover; a corner is a bracket hugging the tile's corner. */
const GAP =
  'after:bg-border-hover after:rounded-full after:opacity-0 hover:after:opacity-100 data-on:after:opacity-100'
const CORNER =
  'after:size-3.5 after:border-border-hover hover:after:border-text-secondary data-on:after:border-text-secondary'

const HANDLES: readonly { handle: Handle; label: string; className: string }[] = [
  {
    handle: 'left',
    label: 'Resize the Shapes tile',
    className: `inset-y-0 -left-2.5 w-2.5 cursor-col-resize after:inset-y-3 after:left-1 after:w-0.5 ${GAP}`,
  },
  {
    handle: 'right',
    label: 'Resize the inspector',
    className: `inset-y-0 -right-2.5 w-2.5 cursor-col-resize after:inset-y-3 after:left-1 after:w-0.5 ${GAP}`,
  },
  {
    handle: 'bottom',
    label: 'Resize the command',
    className: `inset-x-0 -bottom-2.5 h-2.5 cursor-row-resize after:inset-x-3 after:top-1 after:h-0.5 ${GAP}`,
  },
  {
    handle: 'left-bottom',
    label: 'Resize the Shapes tile and the command',
    className: `-bottom-2.5 -left-7.5 size-7.5 cursor-nwse-resize after:top-0 after:left-0 after:rounded-br-sm after:border-r-2 after:border-b-2 ${CORNER}`,
  },
  {
    handle: 'right-bottom',
    label: 'Resize the inspector and the command',
    className: `-right-7.5 -bottom-2.5 size-7.5 cursor-nesw-resize after:top-0 after:right-0 after:rounded-bl-sm after:border-b-2 after:border-l-2 ${CORNER}`,
  },
]

export function TileHandles({
  sizes,
  measure,
  onResize,
}: {
  sizes: TileSizes
  /** The tiles' sizes now, read when a drag begins. */
  measure: () => Measured | null
  onResize: (sizes: TileSizes) => void
}) {
  const start = (handle: Handle) => (event: PointerEvent<HTMLElement>) => {
    const from = measure()
    if (event.button !== 0 || from === null) return
    event.preventDefault()
    event.stopPropagation()
    const el = event.currentTarget
    el.setPointerCapture(event.pointerId)
    el.dataset.on = ''
    const x0 = event.clientX
    const y0 = event.clientY
    const before = sizes
    const move = (m: globalThis.PointerEvent) =>
      onResize(dragTiles(before, handle, from, m.clientX - x0, m.clientY - y0))
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      delete el.dataset.on
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const nudge = (handle: Handle) => (event: KeyboardEvent<HTMLElement>) => {
    const arrow = ARROWS[event.key]
    const from = measure()
    if (arrow === undefined || from === null) return
    event.preventDefault()
    event.stopPropagation()
    onResize(dragTiles(sizes, handle, from, arrow[0] * KEY_STEP.x, arrow[1] * KEY_STEP.y))
  }

  return HANDLES.map(({ handle, label, className }) => (
    <div
      key={handle}
      // aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- a focusable splitter, which an <hr> cannot be
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={handle === 'bottom' ? 'horizontal' : 'vertical'}
      onPointerDown={start(handle)}
      onKeyDown={nudge(handle)}
      onDoubleClick={() => onResize(resetTiles(sizes, handle))}
      className={`pointer-events-auto absolute z-10 hidden touch-none outline-none focus-visible:after:opacity-100 md:block ${className} after:absolute after:transition-[opacity,border-color] motion-reduce:after:transition-none`}
    />
  ))
}
