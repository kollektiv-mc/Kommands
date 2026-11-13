import { describe, expect, it } from 'vitest'
import { chooseColumns, layoutTiles, MIN_FILL, pack } from './tileLayout'

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

describe('layoutTiles', () => {
  it('drops to fewer columns when a state has fewer tiles', () => {
    expect(layoutTiles([2, 2], 3)?.cols).toBe(2)
    expect(layoutTiles([2], 3)).toMatchObject({ cols: 1, width: 'wide' })
  })

  it('narrows rather than stretch a tall tile beside short ones', () => {
    // Two one-line tiles and a five-row list: side by side, both short ones would
    // stretch three rows; stacked beside it, they stretch one between them.
    expect(layoutTiles([2, 2, 5], 3)).toMatchObject({ cols: 2, stretched: 1 })
  })

  it('puts a band tile below the columns, across them', () => {
    const layout = layoutTiles([2, 4, 2], 2, [false, true, false])
    expect(layout).toMatchObject({ cols: 2, rows: 6 })
    expect(layout?.place[1]).toEqual({ col: 0, row: 2, span: 4, band: true })
  })

  it('lays out a lone band tile in one wide column', () => {
    expect(layoutTiles([4], 2, [true])).toMatchObject({ cols: 1, width: 'wide', rows: 4 })
  })
})
