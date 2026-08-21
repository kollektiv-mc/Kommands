import { describe, expect, test } from 'vitest'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { generate } from '../data/authored/commands/worldedit/generate'
import { pathsForTarget, qualify, resolveTarget, staticLocations } from './addressing'
import type { CommandDefinition } from './types'

/**
 * What a name means, as distinct from where its value sits.
 *
 * Asserted against the *derived* artefact rather than a fixture, because the whole
 * problem is a property of what mcmeta actually emits: Brigadier addresses nodes by
 * position and so never had a reason to make names unique. A transcription would be
 * free to be tidier than the real thing, which is exactly the failure mode here.
 */
const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
const EXECUTE = commands['vanilla:execute']!
const LOOT = commands['vanilla:loot']!
const TELEPORT = commands['vanilla:teleport']!

describe('a bare name, when it means one thing', () => {
  test('resolves to exactly one node', () => {
    expect(resolveTarget(EXECUTE.root, 'heightmap')).toHaveLength(1)
  })

  test('a name nothing carries resolves to nothing, rather than to something near it', () => {
    expect(resolveTarget(EXECUTE.root, 'heightma')).toHaveLength(0)
    expect(resolveTarget(EXECUTE.root, 'targets')).not.toHaveLength(0)
  })
})

describe('a duplicated name, which is what the derived skeletons are full of', () => {
  test('/execute has thirty-six argument nodes called scale', () => {
    // The number is upstream's, not this repo's. If a deriver change moves it, the
    // interesting question is which change — so pin it rather than assert "many".
    expect(resolveTarget(EXECUTE.root, 'scale')).toHaveLength(36)
  })

  test('the enclosing keywords tell them apart', () => {
    expect(resolveTarget(EXECUTE.root, 'result/block/byte/scale')).toHaveLength(1)
  })

  test('and qualify finds the shortest chain that does', () => {
    const [first] = resolveTarget(EXECUTE.root, 'scale')
    expect(qualify(EXECUTE.root, first!)).toBe('result/block/byte/scale')
  })
})

describe('the chain is a contiguous suffix, not a subsequence', () => {
  test('a keyword that is not the one immediately above resolves to nothing', () => {
    // `store` *is* in scale's chain — it is just not adjacent to it. Allowing a
    // subsequence would let one selector mean two unrelated clauses that happen to
    // share an outer word.
    expect(resolveTarget(EXECUTE.root, 'store/scale')).toHaveLength(0)
  })

  test('a chain read from the outside in resolves to nothing, pinning the direction', () => {
    expect(resolveTarget(EXECUTE.root, 'execute/scale')).toHaveLength(0)
  })

  test('the command name never has to be spelled, but may be', () => {
    expect(resolveTarget(EXECUTE.root, 'execute/store/result/block/byte/scale')).toHaveLength(1)
  })
})

describe('the two commands no keyword can separate', () => {
  // Recorded as a fact rather than discovered later. Brigadier tells these apart by
  // position alone, so no selector built out of keywords can. Neither command is
  // addressed by a constraint or a preview, and if one ever is, that is the moment to
  // decide what to do about it — against a real case rather than a hypothetical one.
  test('/loot collides inside one identical chain', () => {
    expect(resolveTarget(LOOT.root, 'replace/block/fish/pos')).toHaveLength(2)
  })

  test('/teleport has no intervening literal at all, so qualify gives the name back', () => {
    const [first] = resolveTarget(TELEPORT.root, 'destination')
    expect(resolveTarget(TELEPORT.root, 'destination')).toHaveLength(2)
    expect(qualify(TELEPORT.root, first!)).toBe('destination')
  })
})

describe('flags resolve the same way arguments do', () => {
  test('a flag carries its own leading dash', () => {
    expect(resolveTarget(generate.root, '-h')).toHaveLength(1)
    expect(resolveTarget(generate.root, '-r')).toHaveLength(1)
  })

  test('without the dash it names nothing — a flag is not an argument', () => {
    expect(resolveTarget(generate.root, 'h')).toHaveLength(0)
  })

  test('and it reports which table its value lives in', () => {
    expect(pathsForTarget(generate.root, '-h', {})).toEqual([{ kind: 'flag', path: '/1/-h' }])
    expect(pathsForTarget(generate.root, 'pattern', {})).toEqual([{ kind: 'argument', path: '/2' }])
  })
})

describe('a Ref is not descended into', () => {
  test('an embedded command’s arguments are not addressable from its host', () => {
    // /execute … run <command> embeds a whole other definition. Its names belong to
    // that definition's path space, and a constraint reaching across would be
    // cross-definition constraints — a different feature, not a wider selector.
    // `item` is /give's; /execute has no argument of that name of its own.
    expect(resolveTarget(EXECUTE.root, 'item')).toHaveLength(0)
  })
})

describe('static resolution does not depend on how much the user has filled in', () => {
  test('a name under a Repeat means one node however many clauses exist', () => {
    const before = resolveTarget(EXECUTE.root, 'result/block/byte/scale').length
    expect(before).toBe(1)
    expect(staticLocations(EXECUTE.root)).toHaveLength(142)
  })

  test('but it occupies one path per clause, which is what a constraint reads', () => {
    // The distinction the old code could not draw: three paths here is a clause
    // repeated three times, not a name that means three things.
    const repeat = '/1'
    expect(pathsForTarget(EXECUTE.root, 'result/block/byte/scale', { [repeat]: 3 })).toHaveLength(3)
    expect(pathsForTarget(EXECUTE.root, 'result/block/byte/scale', { [repeat]: 0 })).toHaveLength(0)
  })
})
