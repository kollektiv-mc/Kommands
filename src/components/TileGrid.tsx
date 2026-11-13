import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { chooseColumns, layoutTiles, type Placement, type TileSize } from '../lib/tileLayout'
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
 * The column count comes from the command's busiest state and holds while choices add
 * and remove tiles; where each tile sits is decided per state, and a tile that needs the
 * full width (a message) takes a band below the columns. Tiles enter, leave and move with the shared motion (`useMotion`), keyed by path, so a choice that swaps the
 * tiles under it reads as the tiles rearranging rather than the form being replaced.
 */
export function TileGrid({ tiles, busiest }: { tiles: readonly Tile[]; busiest: TileSize[] }) {
  const [grid] = useMotion<HTMLDivElement>()
  const cols = useMemo(() => chooseColumns(busiest), [busiest])
  const signature = tiles.map((t) => `${t.size}${t.wide ? 'w' : ''}`).join(',')
  const layout = useMemo(
    () =>
      layoutTiles(
        tiles.map((t) => t.size),
        cols,
        tiles.map((t) => t.wide === true),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the sizes are the dependency
    [signature, cols],
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
