import { expect, test } from 'vitest'
import { loadCatalogue } from './catalogue'
import { loadFingerprints } from './loadGenerated'
import { fingerprintOf } from '../schema/fingerprint'
import { v1_21_1 } from './versions/1.21.1'
import type { CommandDefinition } from '../schema/types'

/**
 * The committed index is only worth having if it says what `fingerprintOf` would say.
 *
 * Everything downstream leans on that: the dashboard trusts the index instead of
 * loading 560 KB of skeletons, and the `generated` clean-diff check in
 * .claude/suite.json turns a moved fingerprint into a reviewable line in a pull
 * request. An index that had drifted from the function would break both quietly — a
 * tile calling a live tree stale, and a real structural change merging unnoticed.
 */
test('the index matches fingerprintOf for every definition in the catalogue', async () => {
  const [catalogue, index] = await Promise.all([loadCatalogue(v1_21_1), loadFingerprints(v1_21_1)])

  const ids = Object.keys(catalogue).sort()
  expect(ids.length).toBeGreaterThan(0)
  // Both directions: a definition missing from the index would leave the dashboard
  // unable to judge it, and an index entry with no definition is a stale key that
  // survived a command being removed.
  expect(Object.keys(index).sort()).toEqual(ids)

  const recomputed = Object.fromEntries(
    ids.map((id) => [id, fingerprintOf(catalogue[id] as CommandDefinition)]),
  )
  expect(index).toEqual(recomputed)
})

/**
 * The negative control the assertion above needs to mean anything.
 *
 * Without it, an index built by a generator that had quietly stopped walking the tree
 * — emitting one constant for everything — would pass, because the comparison would
 * be reflexive. These assert the fingerprint still moves for a structural change and
 * still holds for a presentational one, which is the property `persistence.md`
 * § How values are keyed actually asks for.
 */
test('a structural change moves a definition away from its committed fingerprint', async () => {
  const [catalogue, index] = await Promise.all([loadCatalogue(v1_21_1), loadFingerprints(v1_21_1)])
  // /give: literal, then two arguments. Reordering the root's children is exactly the
  // move that repoints every stored path into it.
  const give = catalogue['vanilla:give'] as CommandDefinition
  expect(give.root.kind).toBe('sequence')
  const root = give.root as Extract<CommandDefinition['root'], { kind: 'sequence' }>
  const reordered: CommandDefinition = {
    ...give,
    root: { ...root, nodes: [...root.nodes].reverse() },
  }
  expect(fingerprintOf(reordered)).not.toBe(index['vanilla:give'])
})

test('a presentational change leaves a definition on its committed fingerprint', async () => {
  const [catalogue, index] = await Promise.all([loadCatalogue(v1_21_1), loadFingerprints(v1_21_1)])
  const give = catalogue['vanilla:give'] as CommandDefinition
  // Relabelling must not orphan a save — the other half of the tripwire's contract.
  const relabelled: CommandDefinition = { ...give, label: 'Give an item (renamed)' }
  expect(fingerprintOf(relabelled)).toBe(index['vanilla:give'])
})
