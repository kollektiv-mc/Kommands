import { describe, expect, test } from 'vitest'
import { loadCatalogue } from '../../catalogue'
import { loadCommands } from '../../loadGenerated'
import { v1_21_1 } from '../../versions/1.21.1'
import { NO_REGISTRIES } from '../../versions/registry'
import { argumentNodesFor } from '../../../schema/addressing'
import { argumentOptions, lookupArgumentType } from '../../../schema/argument-types'
import { EMPTY_VALUE, serializeCommand, type CommandValue } from '../../../schema/serialize'
import { authoredDefaults, withDefaults } from '.'

const ctx = { traits: v1_21_1.traits, registries: NO_REGISTRIES }
const derived = await loadCommands(v1_21_1)
const catalogue = await loadCatalogue(v1_21_1)
const entries = Object.entries(authoredDefaults()).flatMap(([id, byName]) =>
  Object.entries(byName).map(([selector, fallback]) => ({ id, selector, fallback })),
)

describe('every authored default', () => {
  // The same bar invariant 7 sets for a constraint target: a selector that names no
  // node attaches nothing and nobody notices, and one that names two cannot be told
  // which it meant.
  test.each(entries)('$id $selector names exactly one optional argument', ({ id, selector }) => {
    const definition = derived[id]
    expect(definition, `${id} is not a command`).toBeDefined()
    const nodes = argumentNodesFor(definition!.root, selector)
    expect(nodes).toHaveLength(1)
    // A required argument is never empty, so a default on one could never be read.
    expect(nodes[0]!.optional).toBe(true)
  })

  test.each(entries)('$id $selector is a valid value of its type', ({ id, selector, fallback }) => {
    const node = argumentNodesFor(derived[id]!.root, selector)[0]!
    const type = lookupArgumentType(node.type)
    expect(type.validate(fallback, argumentOptions(node), ctx)).toEqual([])
    // And one that writes something: an empty default would reopen the very gap it is
    // there to close.
    expect(type.serialize(fallback, ctx)).not.toBe('')
  })

  test('reaches the catalogue the app loads', () => {
    const [node] = argumentNodesFor(catalogue['vanilla:effect']!.root, 'give/amplifier')
    expect(node?.default).toBe(0)
  })

  test('leaves a command with no entries untouched, by identity', () => {
    const give = derived['vanilla:give']!
    expect(withDefaults(give)).toBe(give)
  })

  test('does not change the tree it was given', () => {
    const effect = derived['vanilla:effect']!
    withDefaults(effect)
    expect(argumentNodesFor(effect.root, 'give/amplifier')[0]?.default).toBeUndefined()
  })
})

describe('through the catalogue, end to end', () => {
  const value = (over: Partial<CommandValue>): CommandValue => ({ ...EMPTY_VALUE, ...over })

  test('/particle with a speed and a count holds its position and spread open', () => {
    const out = serializeCommand(
      catalogue['vanilla:particle']!,
      value({ args: { '/1': 'minecraft:flame', '/4': 0.1, '/5': 20 } }),
      ctx,
    )
    expect(out).toBe('/particle minecraft:flame ~ ~ ~ 0 0 0 0.1 20')
  })

  test('/effect give with only particles hidden writes the amplifier it assumes', () => {
    const out = serializeCommand(
      catalogue['vanilla:effect']!,
      value({
        choices: { '/1': 1, '/1/|1/3': 1 },
        args: {
          '/1/|1/1': '@p',
          '/1/|1/2': 'minecraft:speed',
          '/1/|1/3/|1/0': 60,
          '/1/|1/3/|1/2': true,
        },
      }),
      ctx,
    )
    expect(out).toBe('/effect give @p minecraft:speed 60 0 true')
  })

  test('/effect clear with only an effect clears it from the executor', () => {
    const out = serializeCommand(
      catalogue['vanilla:effect']!,
      value({ choices: { '/1': 0 }, args: { '/1/|0/2': 'minecraft:speed' } }),
      ctx,
    )
    expect(out).toBe('/effect clear @s minecraft:speed')
  })
})
