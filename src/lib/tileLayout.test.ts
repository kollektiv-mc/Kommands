import { describe, expect, it } from 'vitest'
import {
  chooseColumns,
  layoutState,
  MIN_FILL,
  pack,
  planColumns,
  type LayoutTile,
  type TileSize,
} from './tileLayout'

const columnsOf = (layout: ReturnType<typeof pack>) => layout?.place.map((p) => p.col)

describe('pack', () => {
  it('puts three one-line tiles in a row', () => {
    const layout = pack([2, 2, 2], 3)
    expect(layout).toMatchObject({ cols: 3, rows: 2, stretched: 0 })
    expect(columnsOf(layout)).toEqual([0, 1, 2])
  })

  it('stacks short tiles beside a tall one before stretching', () => {
    // Two one-line tiles and a four-row list: the short ones share a column.
    const layout = pack([2, 4, 2], 2)
    expect(layout).toMatchObject({ rows: 4, stretched: 0 })
    expect(layout?.place).toEqual([
      { col: 0, row: 0, span: 2 },
      { col: 1, row: 0, span: 4 },
      { col: 0, row: 2, span: 2 },
    ])
  })

  it('stretches the last tile of a short column to the bottom', () => {
    const layout = pack([2, 3], 2)
    expect(layout).toMatchObject({ rows: 3, stretched: 1 })
    expect(layout?.place[0]).toEqual({ col: 0, row: 0, span: 3 })
  })

  it('gives a filling tile the last column, at least MIN_FILL rows', () => {
    const layout = pack([2, 4, 2, 'fill'], 2)
    expect(layout?.rows).toBe(8)
    expect(layout?.place[3]).toEqual({ col: 1, row: 0, span: 8 })
    expect(pack(['fill'], 1)?.rows).toBe(MIN_FILL)
  })

  it('refuses a column with nothing in it', () => {
    expect(pack([2], 2)).toBeNull()
    expect(pack(['fill', 2], 1)).toBeNull()
  })

  it('reads left to right among equal layouts', () => {
    expect(columnsOf(pack([2, 2, 2, 2, 2, 2], 3))).toEqual([0, 1, 2, 0, 1, 2])
  })

  it('falls back to the greedy split for many tiles', () => {
    const layout = pack(Array<number>(12).fill(2), 4)
    expect(layout).toMatchObject({ rows: 6, stretched: 0 })
  })
})

describe('chooseColumns', () => {
  it('keeps a row of one-line tiles side by side', () => {
    expect(chooseColumns([2, 2, 2])).toBe(3)
    expect(chooseColumns([2, 2, 2, 2, 2, 2])).toBe(3)
  })

  it('stacks a recipient above a message in one wide column', () => {
    expect(chooseColumns([2, 6])).toBe(1)
  })

  it('splits damage-like tiles into two stacked columns', () => {
    expect(chooseColumns([2, 2, 2, 3, 2, 2])).toBe(2)
  })

  it('puts settings beside a filling preview', () => {
    expect(chooseColumns([2, 4, 2, 'fill'])).toBe(2)
  })
})

/** Tiles keyed by their position, as in a state where nothing was embedded. */
const tiles = (sizes: readonly TileSize[], wide: readonly boolean[] = []): LayoutTile[] =>
  sizes.map((size, i) => ({ key: `t${i}`, size, wide: wide[i] }))

/** Lays out one state on its own, the way a command with no choices is. */
const alone = (sizes: readonly TileSize[], wide: readonly boolean[] = []) => {
  const state = tiles(sizes, wide)
  return layoutState(
    state,
    planColumns(
      sizes.filter((_, i) => !wide[i]),
      [state],
    ),
  )
}

describe('layoutState', () => {
  it('drops a column the state leaves empty', () => {
    const plan = planColumns([2, 2, 2], [tiles([2, 2, 2]), tiles([2])])
    expect(plan.cols).toBe(3)
    expect(layoutState(tiles([2]), plan)).toMatchObject({ cols: 1, width: 'standard' })
  })

  it('narrows rather than stretch a tall tile beside short ones', () => {
    // Two one-line tiles and a five-row list: side by side, both short ones would
    // stretch three rows; stacked beside it, they stretch one between them.
    expect(alone([2, 2, 5])).toMatchObject({ cols: 2, stretched: 1 })
  })

  it('puts a band tile below the columns, across them', () => {
    const layout = alone([2, 4, 2], [false, true, false])
    expect(layout).toMatchObject({ cols: 2, rows: 6 })
    expect(layout?.place[1]).toEqual({ col: 0, row: 2, span: 4, band: true })
  })

  it('lays out a lone band tile in one wide column', () => {
    expect(alone([4], [true])).toMatchObject({ cols: 1, width: 'wide', rows: 4 })
  })

  it('keeps a lone field in a column of standard width', () => {
    expect(alone([2])).toMatchObject({ cols: 1, width: 'standard' })
    expect(alone([2, 'fill'])).toMatchObject({ width: 'standard' })
    expect(alone(['fill'])).toMatchObject({ cols: 1, width: 'wide' })
  })

  it('places a tile the plan never saw around the others', () => {
    const plan = planColumns([2, 2], [tiles([2, 2])])
    const state = [...tiles([2, 2]), { key: 'embedded', size: 2 }]
    expect(layoutState(state, plan)?.place.map((p) => p.col)).toEqual([0, 1, 0])
  })
})

describe('planColumns', () => {
  // A name, a choice, and the choice's branches: nothing, one field, or a second
  // choice with fields of its own. The shape of /function.
  const name = { key: 'name', size: 2 }
  const choice = { key: 'choice', size: 3 }
  const states: LayoutTile[][] = [
    [name, choice],
    [name, choice, { key: 'field', size: 2 }],
    [name, choice, { key: 'second', size: 5 }],
    [name, choice, { key: 'second', size: 5 }, { key: 'a', size: 2 }, { key: 'b', size: 2 }],
  ]

  it('keeps every tile in one column across the states', () => {
    const plan = planColumns([2, 3, 5, 2, 2], states)
    const columns = states.map((state) =>
      layoutState(state, plan)!
        .place.slice(0, 2)
        .map((p) => p.col),
    )
    expect(new Set(columns.map((c) => c.join()))).toEqual(new Set(['0,1']))
  })

  it('spreads the tiles every state has across the columns', () => {
    const plan = planColumns([2, 3, 5, 2, 2], states)
    expect(plan.home.get('name')).not.toBe(plan.home.get('choice'))
  })

  it('leaves bands and filling tiles without a home', () => {
    const plan = planColumns(
      [2, 'fill'],
      [[name, { key: 'p', size: 'fill' }, { key: 'm', size: 4, wide: true }]],
    )
    expect([...plan.home.keys()]).toEqual(['name'])
  })

  it('plans many tiles without trying every assignment', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, size: 2 }))
    const plan = planColumns(
      many.map((t) => t.size),
      [many],
    )
    expect(plan.home.size).toBe(12)
    expect(layoutState(many, plan)).toMatchObject({ stretched: 0 })
  })
})
