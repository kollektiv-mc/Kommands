import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  columnNeeds,
  columnTemplate,
  layoutState,
  type ColumnPlan,
  type Placement,
  type TileSize,
} from '../lib/tileLayout'
import { useMotion } from '../lib/useMotion'

export interface Tile {
  key: string
  size: TileSize
  wide?: boolean
  node: ReactNode
}

/** Writes a tile's grid position: computed, so it goes on the element, not in a class. */
function place(cell: HTMLDivElement | null, at: Placement | undefined) {
  if (!cell || !at) return
  cell.style.gridColumn = at.band ? '1 / -1' : String(at.col + 1)
  cell.style.gridRow = `${at.row + 1} / span ${at.span}`
}

/**
 * The editor's tiles on their grid (`lib/tileLayout.ts`).
 *
 * Every tile keeps the column the command's plan gives it (`planColumns`) whichever
 * branch a choice is on, so a choice adds and removes tiles without moving the others
 * to another column. A tile that needs the full width (a message) takes a band below
 * the columns. Tiles enter, leave and move
 * with the shared motion (`useMotion`), keyed by path, so a choice that swaps the tiles
 * under it reads as the tiles rearranging rather than the form being replaced.
 */
export function TileGrid({ tiles, plan }: { tiles: readonly Tile[]; plan: ColumnPlan }) {
  const [grid] = useMotion<HTMLDivElement>()
  const signature = tiles.map((t) => `${t.key}:${t.size}${t.wide ? 'w' : ''}`).join(',')
  const layout = useMemo(
    () => layoutState(tiles, plan),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the keys and sizes are the dependency
    [signature, plan],
  )

  // One stable ref for both jobs: AutoAnimate's controller is set up once per element,
  // and a ref callback made fresh each render would tear it down and set it up again.
  const box = useRef<HTMLDivElement | null>(null)
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      box.current = el
      grid(el)
    },
    [grid],
  )
  useLayoutEffect(() => {
    box.current?.style.setProperty('--tile-cols', String(layout?.cols ?? 1))
    box.current?.style.setProperty('--tile-rows', String(layout?.rows ?? 1))
  }, [layout])

  // Every column as wide as its widest tile needs, measured rather than guessed: what a
  // tile holds is procedural (a choice, an added component, a row per enchantment), and
  // a fixed width squeezed a deep one until its controls wrapped and overlapped. Measured
  // again whenever a tile changes size, which is what adding or removing a field does.
  useLayoutEffect(() => {
    const grid = box.current
    if (!grid || !layout || typeof ResizeObserver === 'undefined') return
    let applied = ''
    const measure = () => {
      const roots = [...grid.children].map((cell) => cell.firstElementChild as HTMLElement | null)
      // All the writes, then all the reads, then the restores: one layout, not one a tile.
      const kept = roots.map((root) => root?.style.width ?? '')
      roots.forEach((root) => root?.style.setProperty('width', 'min-content'))
      const needs = roots.map((root) => root?.offsetWidth ?? 0)
      roots.forEach((root, i) => root?.style.setProperty('width', kept[i] ?? ''))
      const css = columnTemplate(columnNeeds(layout, needs))
      const next = css ? `${css.template}|${css.min}` : ''
      if (next === applied) return
      applied = next
      if (css) {
        grid.style.setProperty('--tile-template', css.template)
        grid.style.setProperty('--tile-min-w', css.min)
      } else {
        grid.style.removeProperty('--tile-template')
        grid.style.removeProperty('--tile-min-w')
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const cell of grid.children)
      if (cell.firstElementChild) observer.observe(cell.firstElementChild)
    return () => observer.disconnect()
  }, [layout, signature])

  return (
    <div
      ref={attach}
      data-columns={layout?.cols ?? 0}
      className={`tile-grid motion-arrive ${layout?.width === 'wide' ? 'tile-grid-wide' : ''}`}
    >
      {tiles.map((tile, i) => (
        <div key={tile.key} ref={(cell) => place(cell, layout?.place[i])} className="tile-cell">
          {tile.node}
        </div>
      ))}
    </div>
  )
}
