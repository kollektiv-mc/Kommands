import { describe, expect, test } from 'vitest'
import { addRow, chanceText, readMix, writeMix } from './mix'

describe('the block mix', () => {
  test('reads a weighted pattern into rows and back', () => {
    const rows = readMix('60%stone, 40%andesite')
    expect(rows.map((r) => [r.block, r.chance])).toEqual([
      ['stone', '60'],
      ['andesite', '40'],
    ])
    expect(writeMix(rows)).toBe('60%stone,40%andesite')
  })

  test('an empty pattern is one row to type into', () => {
    expect(readMix('').map((r) => r.block)).toEqual([''])
  })

  test('a lone block is written without its chance', () => {
    expect(writeMix([{ key: 1, block: 'stone', chance: '100' }])).toBe('stone')
  })

  test('a row with no block is left out', () => {
    const rows = [...readMix('50%stone,50%dirt'), { key: 9, block: ' ', chance: '5' }]
    expect(writeMix(rows)).toBe('50%stone,50%dirt')
  })

  test('adding a block shares the chances to make 100', () => {
    const rows = addRow(readMix('stone,dirt'))
    expect(rows.map((r) => [r.block, r.chance])).toEqual([
      ['stone', '34'],
      ['dirt', '33'],
      ['', '33'],
    ])
    expect(new Set(rows.map((r) => r.key)).size).toBe(3)
  })

  test('a chance keeps only digits and a point', () => {
    expect(chanceText('4a5.%')).toBe('45.')
  })
})
