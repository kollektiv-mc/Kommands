import { describe, expect, test } from 'vitest'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { makeRegistryLookup } from '../../data/versions/registry'
import type { SerializeContext } from '../../data/versions/types'
import { palette } from '../../data/authored/commands/worldedit/palette'
import { withDefaults } from '../../data/authored/defaults'
import { EMPTY_VALUE, serializeCommand, type CommandValue } from '../serialize'
import {
  EMPTY_MASK,
  NEW_RULE,
  serializeMask,
  serializeRule,
  validateMask,
  type MaskRule,
  type MaskValue,
} from './we-mask'

const ctx: SerializeContext = {
  traits: v1_21_1.traits,
  registries: makeRegistryLookup({
    block: ['stone', 'dirt', 'grass_block', 'air'],
    'tag/block': ['logs', 'leaves'],
    'worldgen/biome': ['plains'],
  }),
}

const mask = (patch: Partial<MaskValue>): MaskValue => ({ ...EMPTY_MASK, ...patch })
const rule = (patch: Partial<MaskRule>): MaskRule => ({ ...NEW_RULE, ...patch })

describe('serializing a WorldEdit mask', () => {
  test('an empty mask writes nothing', () => {
    expect(serializeMask(EMPTY_MASK)).toBe('')
  })

  test('included blocks are one comma list', () => {
    expect(serializeMask(mask({ include: ['stone', 'dirt'] }))).toBe('stone,dirt')
  })

  test('an included tag is written ##, and replaces blocks beside it', () => {
    expect(serializeMask(mask({ include: ['#logs'] }))).toBe('##logs')
    expect(serializeMask(mask({ include: ['stone', '#logs'] }))).toBe('##logs')
  })

  test('excluded blocks are one negated list, each tag its own', () => {
    const value = mask({ exclude: ['stone', '#logs', 'dirt', '#leaves'] })
    expect(serializeMask(value)).toBe('"!stone,dirt !##logs !##leaves"')
  })

  test('a chance is a real percentage, and 100 is left out', () => {
    expect(serializeMask(mask({ chance: 40 }))).toBe('%40')
    expect(serializeMask(mask({ chance: 100 }))).toBe('')
  })

  test('several masks are quoted, because they are one argument', () => {
    // WorldEdit's docs write it the same way: //replace "stone <air" dirt.
    const value = mask({ include: ['stone'], rules: [rule({ test: 'air', offset: 1 })] })
    expect(serializeMask(value)).toBe('"stone <#air"')
  })

  test('the block above is written <, the block below >', () => {
    expect(serializeRule(rule({ test: 'tag', text: 'logs', offset: 2 }))).toBe('<<##logs')
    expect(serializeRule(rule({ test: 'blocks', values: ['dirt'], offset: -1 }))).toBe('>dirt')
  })

  test('not comes before the offset, negating the moved mask', () => {
    expect(serializeRule(rule({ test: 'solid', not: true, offset: -1 }))).toBe('!>#solid')
  })

  test('an offset on a test it cannot move is left out', () => {
    expect(serializeRule(rule({ test: 'chance', chance: 30, offset: 2 }))).toBe('%30')
  })

  test('states are lenient by default and strict when exact', () => {
    expect(serializeRule(rule({ test: 'states', values: ['open=false'] }))).toBe('^[open=false]')
    expect(serializeRule(rule({ test: 'states', values: ['open=false'], exact: true }))).toBe(
      '^=[open=false]',
    )
  })

  test('an expression loses its spaces, which would split the mask', () => {
    expect(serializeRule(rule({ test: 'expression', text: 'y < 64' }))).toBe('=y<64')
  })

  test('biomes are one $ list, the fixed tests their word', () => {
    expect(serializeRule(rule({ test: 'biome', values: ['plains', 'desert'] }))).toBe(
      '$plains,desert',
    )
    expect(serializeRule(rule({ test: 'surface' }))).toBe('#surface')
    expect(serializeRule(rule({ test: 'existing' }))).toBe('#existing')
    expect(serializeRule(rule({ test: 'selection' }))).toBe('#sel')
  })

  test('a rule with nothing to test yet is left out', () => {
    expect(serializeMask(mask({ rules: [rule({ test: 'blocks' })] }))).toBe('')
  })
})

describe('validating a WorldEdit mask', () => {
  const messages = (value: MaskValue) => validateMask(value, ctx).map((d) => d.message)

  test('a block, tag or biome the version lacks warns', () => {
    expect(messages(mask({ include: ['stnoe'] }))[0]).toContain('stnoe')
    expect(messages(mask({ exclude: ['#lgos'] }))[0]).toContain('lgos')
    expect(messages(mask({ rules: [rule({ test: 'biome', values: ['mars'] })] }))[0]).toContain(
      'mars',
    )
  })

  test('a tag beside blocks says only the tag is used', () => {
    expect(messages(mask({ include: ['stone', '#logs'] })).join()).toContain('Only the tag')
  })

  test('a state not written name=value warns', () => {
    expect(messages(mask({ rules: [rule({ test: 'states', values: ['open'] })] }))).toHaveLength(1)
  })

  test('a known mask is clean', () => {
    expect(messages(mask({ include: ['#logs'], exclude: ['dirt'], chance: 50 }))).toEqual([])
  })
})

describe('the Palette Editor', () => {
  const definition = withDefaults(palette)
  const write = (value: Partial<CommandValue>) =>
    serializeCommand(definition, { ...EMPTY_VALUE, ...value }, ctx)
  const blocks = (...ids: string[]) => ({ entries: ids.map((block) => ({ block, weight: '' })) })

  test('opens on //replace, an empty mask written #existing', () => {
    // RegionCommands.replace: `from` defaults to an ExistingBlockMask, so the slot the
    // pattern needs is filled with what WorldEdit would have used.
    expect(write({ args: { '/|0/2': blocks('dirt') } })).toBe('//replace #existing dirt')
  })

  test('a masked //replace', () => {
    const args = { '/|0/1': mask({ include: ['stone'], chance: 50 }), '/|0/2': blocks('dirt') }
    expect(write({ args })).toBe('//replace "stone %50" dirt')
  })

  test('//gmask with no mask clears it', () => {
    expect(write({ choices: { '': 2 } })).toBe('//gmask')
  })

  test('//smooth fills its passes when a mask follows them', () => {
    const args = { '/|3/2': mask({ include: ['grass_block'] }) }
    expect(write({ choices: { '': 3 }, args })).toBe('//smooth 1 grass_block')
  })

  test('a brush is written with one slash and its shape', () => {
    const args = { '/|4/1/|0/2': blocks('stone'), '/|4/1/|0/3': 3 }
    const flags = { '/|4/1/|0/1/-h': true }
    expect(write({ choices: { '': 4 }, args, flags })).toBe('/brush sphere -h stone 3')
  })

  test('/brush set takes its radius before the pattern', () => {
    const args = { '/|4/1/|2/1': 'cuboid', '/|4/1/|2/3': blocks('stone') }
    expect(write({ choices: { '': 4, '/|4/1': 2 }, args })).toBe('/brush set cuboid 5 stone')
  })
})
