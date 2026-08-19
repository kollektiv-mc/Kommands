import { describe, expect, test } from 'vitest'
import { diffRegistries, formatDiff } from './registry-diff'

describe('registry diff', () => {
  test('reports nothing when nothing moved', () => {
    expect(diffRegistries({ item: ['stone'] }, { item: ['stone'] })).toEqual([])
  })

  test('separates additions from removals', () => {
    const [change] = diffRegistries({ item: ['a', 'b'] }, { item: ['b', 'c'] })
    expect(change).toMatchObject({ registry: 'item', added: ['c'], removed: ['a'] })
  })

  test('recognises a category prefix being dropped', () => {
    // The 1.21.2 attribute rename in miniature. Reported as a plain wipe it reads as
    // 3 removed and 4 added, and the one genuinely new entry is lost in the noise.
    const before = { attribute: ['generic.armor', 'player.mining_efficiency', 'zombie.spawn'] }
    const after = { attribute: ['armor', 'mining_efficiency', 'spawn', 'tempt_range'] }
    const [change] = diffRegistries(before, after)
    expect(change?.reprefixed).toEqual([
      { from: 'generic.armor', to: 'armor' },
      { from: 'player.mining_efficiency', to: 'mining_efficiency' },
      { from: 'zombie.spawn', to: 'spawn' },
    ])
    const report = formatDiff([change!], '1.21.1', '1.21.5')
    expect(report).toContain('3 re-prefixed')
    expect(report).toContain('tempt_range')
    // Re-prefixed ids are not outright removals, so the summary must not cry wolf.
    expect(report).toContain('No outright removals')
  })

  test('an outright removal is called out as breaking', () => {
    const report = formatDiff(
      diffRegistries({ entity_type: ['zombie', 'gone'] }, { entity_type: ['zombie'] }),
      '1.21.1',
      '1.21.5',
    )
    expect(report).toContain('REMOVED')
    expect(report).toContain('gone')
    expect(report).toContain('1 outright removal')
  })

  test('a registry added or dropped wholesale is still reported', () => {
    const changes = diffRegistries({ old_reg: ['x'] }, { new_reg: ['y'] })
    expect(changes.map((c) => c.registry).sort()).toEqual(['new_reg', 'old_reg'])
  })
})
