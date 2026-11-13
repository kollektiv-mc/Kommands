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
  // An empty column is dropped from the sheet (`layoutState`), so it stretches nothing.
  const stretched = heights.reduce((sum, h) => sum + (h > 0 ? rows - h : 0), 0)
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

/** A tile as the layout sees it: its identity across states, its rows, whether it is a band. */
export interface LayoutTile {
  key: string
  size: TileSize
  wide?: boolean
}

/**
 * Where a command's tiles live, decided once for every state the command can be in.
 *
 * `home` gives each tile that is not a band or a filling tile the column it takes
 * whenever it is on screen. A choice then adds and removes tiles around the others but
 * never moves one to another column: the tile that was just clicked stays where it
 * was, and what changed is what appeared or left.
 */
export interface ColumnPlan {
  cols: number
  width: ColumnWidth
  home: ReadonlyMap<string, number>
}

/** Above this many tiles across all states the plan is built greedily. */
const PLAN_EXHAUSTIVE_LIMIT = 8
/** How many rounds of single moves refine a greedy plan. */
const IMPROVE_PASSES = 4
/**
 * How much the state a command opens in counts, against all the others together:
 * every user sees it, so it keeps the layout it would have on its own wherever the
 * plan allows.
 */
const OPENING_WEIGHT = 3
/**
 * What a column a state leaves empty costs, in rows. The column is dropped, so the
 * sheet narrows; without a cost the cheapest plan stacks light states in one tall column.
 */
const EMPTY_COLUMN_COST = 6

/**
 * The plan for a command: its column count from the busiest state (`chooseColumns`),
 * and a column for each tile chosen against every state at once.
 *
 * Each way of giving the tiles columns is scored by summing, over the states, what
 * `pack` scores one layout by (rows, three per stretched row, then reading order), plus
 * `EMPTY_COLUMN_COST` per column a state leaves empty, with the opening state weighted
 * by `OPENING_WEIGHT`. Up to `PLAN_EXHAUSTIVE_LIMIT` tiles every assignment is tried;
 * past it each tile takes the cheapest column in turn, then single moves improve on that.
 */
export function planColumns(
  busiest: readonly TileSize[],
  states: readonly (readonly LayoutTile[])[],
): ColumnPlan {
  const cols = chooseColumns(busiest)
  const width: ColumnWidth = cols === 1 ? 'wide' : 'standard'
  const keys: string[] = []
  const index = new Map<string, number>()
  let fills = 0
  const shapes = states.map((tiles) => {
    const inColumns = tiles.filter((t) => !t.wide)
    fills = Math.max(fills, inColumns.filter((t) => t.size === 'fill').length)
    return {
      hasFill: inColumns.some((t) => t.size === 'fill'),
      tiles: inColumns.flatMap((t) => {
        if (t.size === 'fill') return []
        if (!index.has(t.key)) index.set(t.key, keys.push(t.key) - 1)
        return [{ key: index.get(t.key)!, size: t.size }]
      }),
    }
  })
  const free = cols - fills
  if (free < 1 || keys.length === 0) return { cols, width, home: new Map() }

  // Tiles from `known` on are not placed yet and left out, which is what lets the
  // greedy build below score a partial assignment with the same function.
  const cost = (assign: readonly number[], known = keys.length): [number, number] => {
    let total = 0
    let disorder = 0
    shapes.forEach((shape, s) => {
      const tiles = shape.tiles.filter((t) => t.key < known)
      const [c, d] = stateCost(
        tiles.map((t) => t.size),
        tiles.map((t) => assign[t.key]!),
        free,
        shape.hasFill,
      )
      const weight = s === 0 ? OPENING_WEIGHT * shapes.length : 1
      total += c * weight
      disorder += d * weight
    })
    return [total, disorder]
  }

  const assign = Array<number>(keys.length).fill(0)
  if (keys.length <= PLAN_EXHAUSTIVE_LIMIT) {
    let best: { score: [number, number]; assign: number[] } | null = null
    const visit = (i: number, opened: number) => {
      if (i === keys.length) {
        const score = cost(assign)
        if (best === null || less(score, best.score)) best = { score, assign: [...assign] }
        return
      }
      for (let c = 0; c <= Math.min(opened, free - 1); c++) {
        assign[i] = c
        visit(i + 1, Math.max(opened, c + 1))
      }
    }
    visit(0, 0)
    assign.splice(0, assign.length, ...((best as { assign: number[] } | null)?.assign ?? assign))
  } else {
    // Each tile, in the order the states first show it, into the column that costs
    // least with the tiles placed so far.
    keys.forEach((_, k) => {
      let bestCol = 0
      let bestScore: [number, number] | null = null
      for (let c = 0; c < free; c++) {
        assign[k] = c
        const score = cost(assign, k + 1)
        if (bestScore === null || less(score, bestScore)) [bestScore, bestCol] = [score, c]
      }
      assign[k] = bestCol
    })
    // Then single moves while one helps: placing in order cannot see that a tile put
    // beside the first would read better under it once the third arrives.
    let score = cost(assign)
    for (let pass = 0, moved = true; moved && pass < IMPROVE_PASSES; pass++) {
      moved = false
      keys.forEach((_, k) => {
        const was = assign[k]!
        for (let c = 0; c < free; c++) {
          if (c === was) continue
          assign[k] = c
          const next = cost(assign)
          if (less(next, score)) {
            score = next
            moved = true
            return
          }
        }
        assign[k] = was
      })
    }
  }
  return { cols, width, home: new Map(keys.map((key, k) => [key, assign[k]!])) }
}

/**
 * One state's cost under an assignment: rows plus three per stretched row, a column
 * left empty counting as stretched; and, apart, how far it reads from argument order.
 */
function stateCost(
  units: readonly number[],
  assign: readonly number[],
  free: number,
  hasFill: boolean,
): [number, number] {
  const [stretched, rows, disorder] = scoreOf(units, assign, free, hasFill)
  let empty = 0
  for (let c = 0; c < free; c++) if (!assign.includes(c)) empty++
  return [stretched * 3 + rows + empty * EMPTY_COLUMN_COST, disorder]
}

/**
 * The layout for the tiles on screen now, in the command's plan.
 *
 * A tile with a home takes it. A tile the plan does not know (one an embedded command
 * brought) goes where it costs least around them. A column this state leaves empty is
 * dropped rather than drawn, so the sheet narrows instead of showing a hole.
 */
export function layoutState(tiles: readonly LayoutTile[], plan: ColumnPlan): TileLayout | null {
  const band = tiles.map((t) => t.wide === true)
  const inColumns = tiles.filter((t) => !t.wide)
  if (inColumns.length === 0) {
    const empty: TileLayout = { cols: 1, width: 'wide', rows: 0, stretched: 0, place: [] }
    return tiles.length === 0
      ? empty
      : withBands(
          empty,
          tiles.map((t) => t.size),
          band,
        )
  }
  const fills = inColumns.flatMap((t, i) => (t.size === 'fill' ? [i] : []))
  const std = inColumns.flatMap((t, i) => (t.size === 'fill' ? [] : [i]))
  const free = Math.max(plan.cols - fills.length, std.length > 0 ? 1 : 0)
  const units = std.map((i) => inColumns[i]!.size as number)
  const fixed = std.map((i) => {
    const home = plan.home.get(inColumns[i]!.key)
    return home !== undefined && home < free ? home : undefined
  })
  const assign = settle(units, fixed, free, fills.length > 0)

  // Columns this state leaves empty are dropped, the rest keep their order.
  const used = Array.from({ length: free }, (_, c) => assign.includes(c))
  const renumber = used.map((_, c) => used.slice(0, c).filter(Boolean).length)
  const kept = used.filter(Boolean).length
  const columns = assign.map((c) => renumber[c]!)

  const heights = Array<number>(kept).fill(0)
  columns.forEach((c, k) => (heights[c]! += units[k]!))
  const rows = Math.max(fills.length > 0 ? MIN_FILL : 1, ...heights)
  const place: Placement[] = Array.from({ length: inColumns.length })
  const top = Array<number>(kept).fill(0)
  std.forEach((index, k) => {
    const c = columns[k]!
    place[index] = { col: c, row: top[c]!, span: units[k]! }
    top[c]! += units[k]!
  })
  for (let c = 0; c < kept; c++) {
    const last = std.findLast((_, k) => columns[k] === c)
    if (last !== undefined) place[last]!.span += rows - heights[c]!
  }
  fills.forEach((index, n) => (place[index] = { col: kept + n, row: 0, span: rows }))
  const stretched = heights.reduce((sum, h) => sum + rows - h, 0)
  const layout: TileLayout = {
    cols: kept + fills.length,
    width: plan.width,
    rows,
    stretched,
    place,
  }
  if (inColumns.length === tiles.length) return layout
  return withBands(
    layout,
    tiles.map((t) => t.size),
    band,
  )
}

/** Above this many tiles without a home, they are placed greedily. */
const SETTLE_EXHAUSTIVE_LIMIT = 6

/** Columns for the tiles without one, around the tiles whose column is `fixed`. */
function settle(
  units: readonly number[],
  fixed: readonly (number | undefined)[],
  free: number,
  hasFill: boolean,
): number[] {
  const assign = fixed.map((c) => c ?? 0)
  const open = fixed.flatMap((c, k) => (c === undefined ? [k] : []))
  if (open.length === 0) return assign
  const score = () => scoreOf(units, assign, free, hasFill)
  if (open.length > SETTLE_EXHAUSTIVE_LIMIT) {
    for (const k of open) {
      let best: { score: [number, number, number]; col: number } | null = null
      for (let c = 0; c < free; c++) {
        assign[k] = c
        const s = score()
        if (best === null || less(s, best.score)) best = { score: s, col: c }
      }
      assign[k] = best!.col
    }
    return assign
  }
  let best: { score: [number, number, number]; assign: number[] } | null = null
  const visit = (n: number) => {
    if (n === open.length) {
      const s = score()
      if (best === null || less(s, best.score)) best = { score: s, assign: [...assign] }
      return
    }
    for (let c = 0; c < free; c++) {
      assign[open[n]!] = c
      visit(n + 1)
    }
  }
  visit(0)
  return (best as { assign: number[] } | null)?.assign ?? assign
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
