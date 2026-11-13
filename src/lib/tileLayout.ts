/**
 * Where the editor's tiles go: which column, which row, how many rows.
 *
 * The editor lays every command out by this one procedure rather than by a layout per
 * command. Tiles sit on a grid of short rows; each tile takes a whole number of them
 * (`TileSize`), and a tile that brings its own editor (a chain of steps, a 3D preview)
 * fills a column of its own. Within a column tiles keep argument order, and the last
 * tile of a short column stretches so every column ends on the same row: a sheet whose
 * tiles end at different heights reads as unfinished.
 *
 * Pure, so the rules are tested here rather than through a rendered form.
 */

/** Rows a tile takes, or `'fill'` for a tile that takes a column to itself. */
export type TileSize = number | 'fill'

/** One column of standard width, or one twice as wide for a command that reads better stacked. */
export type ColumnWidth = 'standard' | 'wide'

export interface Placement {
  col: number
  row: number
  span: number
  /** Set on a band tile, which spans every column. */
  band?: true
}

export interface TileLayout {
  cols: number
  width: ColumnWidth
  rows: number
  /** Rows given to tiles beyond their own size, so the columns end level. */
  stretched: number
  place: Placement[]
}

/** The fewest rows a filling tile gets, so a preview or a chain never collapses to a strip. */
export const MIN_FILL = 6
/** Above this many tiles the exhaustive search is skipped for the greedy one. */
const EXHAUSTIVE_LIMIT = 8
export const MAX_COLUMNS = 4

/**
 * Lays `sizes` out in `cols` columns, or returns null when they cannot be: more
 * filling tiles than columns, or fewer standard tiles than the columns left for them.
 *
 * Tries every way to share the standard tiles between the columns (they are few, so
 * this is cheap) and keeps the one that stretches least, then the shortest, then the
 * one that reads left to right, then down, closest to argument order.
 */
export function pack(sizes: readonly TileSize[], cols: number): TileLayout | null {
  const fills = sizes.flatMap((s, i) => (s === 'fill' ? [i] : []))
  const std = sizes.flatMap((s, i) => (s === 'fill' ? [] : [i]))
  const units = std.map((i) => sizes[i] as number)
  const free = cols - fills.length
  if (free < 0 || (std.length > 0 && (free < 1 || std.length < free))) return null
  if (std.length === 0 && fills.length === 0) return null

  const assign =
    std.length === 0
      ? []
      : std.length <= EXHAUSTIVE_LIMIT
        ? bestAssignment(units, free, fills.length > 0)
        : greedyAssignment(units, free)

  const heights = Array<number>(Math.max(free, 0)).fill(0)
  assign.forEach((c, k) => (heights[c]! += units[k]!))
  const rows = Math.max(fills.length > 0 ? MIN_FILL : 1, ...heights)

  const place: Placement[] = Array.from({ length: sizes.length })
  const top = Array<number>(Math.max(free, 0)).fill(0)
  std.forEach((index, k) => {
    const c = assign[k]!
    place[index] = { col: c, row: top[c]!, span: units[k]! }
    top[c]! += units[k]!
  })
  // The last tile of each short column takes up the slack.
  for (let c = 0; c < free; c++) {
    const last = std.findLast((_, k) => assign[k] === c)
    if (last !== undefined) place[last]!.span += rows - heights[c]!
  }
  fills.forEach((index, n) => (place[index] = { col: free + n, row: 0, span: rows }))

  const stretched = heights.reduce((sum, h) => sum + rows - h, 0)
  return { cols, width: cols === 1 ? 'wide' : 'standard', rows, stretched, place }
}

/** Every assignment of tiles to columns, columns filled left to right; the best one. */
function bestAssignment(units: readonly number[], free: number, hasFill: boolean): number[] {
  let best: { score: [number, number, number]; assign: number[] } | null = null
  const assign = Array<number>(units.length).fill(0)
  const visit = (i: number, opened: number) => {
    if (i === units.length) {
      if (opened < free) return
      const score = scoreOf(units, assign, free, hasFill)
      if (best === null || less(score, best.score)) best = { score, assign: [...assign] }
      return
    }
    // A tile goes into a column already started or opens the next one, never one past
    // it: the same layout with its columns renamed is not a different layout.
    for (let c = 0; c <= Math.min(opened, free - 1); c++) {
      assign[i] = c
      visit(i + 1, Math.max(opened, c + 1))
    }
  }
  visit(0, 0)
  return (best as { assign: number[] } | null)?.assign ?? greedyAssignment(units, free)
}

/** Each tile into the shortest column so far, in order. */
function greedyAssignment(units: readonly number[], free: number): number[] {
  const heights = Array<number>(free).fill(0)
  return units.map((u) => {
    const c = heights.indexOf(Math.min(...heights))
    heights[c]! += u
    return c
  })
}

function scoreOf(
  units: readonly number[],
  assign: readonly number[],
  free: number,
  hasFill: boolean,
): [number, number, number] {
  const heights = Array<number>(free).fill(0)
  const start = assign.map((c, k) => {
    const row = heights[c]!
    heights[c]! += units[k]!
    return row * free + c
  })
  const rows = Math.max(hasFill ? MIN_FILL : 1, ...heights)
  const stretched = heights.reduce((sum, h) => sum + rows - h, 0)
  let disorder = 0
  for (let a = 0; a < start.length; a++)
    for (let b = a + 1; b < start.length; b++) if (start[a]! > start[b]!) disorder++
  return [stretched, rows, disorder]
}

const less = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!
  return false
}

/**
 * How many columns a command gets, decided from its busiest state.
 *
 * Decided from the busiest state so the sheet is wide enough for every state, and a
 * choice never widens it. Each column count is scored by its rows plus three per
 * stretched row, since a stretched tile is empty space and a tall sheet is not; ties go
 * to more columns, which is the shorter sheet.
 */
export function chooseColumns(busiest: readonly TileSize[]): number {
  return cheapest(busiest, MAX_COLUMNS)?.cols ?? 1
}

/**
 * The layout for the tiles on screen now, at most the command's column count.
 *
 * A state with fewer tiles (a choice left on its shortest branch) may take fewer
 * columns, by the same cost, rather than stretch tiles down columns it no longer
 * fills. The sheet's width then glides (`useSheetSize`) instead of jumping.
 */
export function layoutTiles(
  sizes: readonly TileSize[],
  cols: number,
  band: readonly boolean[] = [],
): TileLayout | null {
  const inColumns = sizes.flatMap((s, i) => (band[i] ? [] : [s]))
  const layout: TileLayout | null =
    inColumns.length === 0
      ? { cols: 1, width: 'wide', rows: 0, stretched: 0, place: [] }
      : cheapest(inColumns, cols)
  if (layout === null || inColumns.length === sizes.length) return layout
  return withBands(layout, sizes, band)
}

/**
 * Puts the band tiles (an editor that needs the sheet's full width, as a message
 * does) below the columns, each across all of them, in argument order among
 * themselves. They are left out of the column count, so a message never forces a
 * command into one tall column.
 */
function withBands(
  layout: TileLayout,
  sizes: readonly TileSize[],
  band: readonly boolean[],
): TileLayout {
  const place: Placement[] = []
  let k = 0
  let row = layout.rows
  sizes.forEach((size, i) => {
    if (!band[i]) {
      place.push(layout.place[k++]!)
      return
    }
    const span = size === 'fill' ? MIN_FILL : size
    place.push({ col: 0, row, span, band: true })
    row += span
  })
  return { ...layout, rows: row, place }
}

/** The layout of one to `most` columns with the lowest cost; ties go to more columns. */
function cheapest(sizes: readonly TileSize[], most: number): TileLayout | null {
  let best: TileLayout | null = null
  const cost = (l: TileLayout) => l.stretched * 3 + l.rows
  for (let cols = most; cols >= 1; cols--) {
    const layout = pack(sizes, cols)
    if (layout === null) continue
    if (best === null || cost(layout) < cost(best)) best = layout
  }
  return best
}
