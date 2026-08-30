import { expect, test } from 'vitest'
import {
  createSaved,
  nextInstanceIdFor,
  renameSaved,
  resumability,
  reviseSaved,
  type SaveClock,
  type SavedCommandDraft,
} from './saved'
import type { CommandValue } from './serialize'
import { EMPTY_VALUE } from './serialize'
import type { VersionDefinition } from '../data/versions/types'
import { v1_21_1 } from '../data/versions/1.21.1'
import { findVersion } from '../data/versions'

/** A clock that counts, so ids and timestamps are readable in a failure message. */
function fixedClock(): SaveClock {
  let tick = 0
  return {
    now: () => `2026-01-01T00:00:0${tick++}.000Z`,
    uuid: () => `uuid-${tick}`,
  }
}

const DRAFT: SavedCommandDraft = {
  name: 'Starter kit',
  definitionId: 'vanilla:give',
  version: v1_21_1.id,
  value: EMPTY_VALUE,
  preview: '/give @p stone',
}

test('a new saved command gets an id and revision 1', () => {
  const saved = createSaved(DRAFT, fixedClock())

  expect(saved.id).toBe('uuid-1')
  expect(saved.revision).toBe(1)
  expect(saved.createdAt).toBe(saved.updatedAt)
})

test('revising keeps the id and bumps the revision', () => {
  const clock = fixedClock()
  const saved = createSaved(DRAFT, clock)
  const next = reviseSaved(saved, { value: EMPTY_VALUE, preview: '/give @p diamond' }, clock)

  // The id is what a linked Konnekt preset points at. If revising minted a new one,
  // every link would break silently and the only symptom would be edits that stop
  // propagating — which is the failure this assertion exists to catch.
  expect(next.id).toBe(saved.id)
  expect(next.revision).toBe(2)
  expect(next.createdAt).toBe(saved.createdAt)
  expect(next.updatedAt).not.toBe(saved.updatedAt)
})

test('renaming moves updatedAt but not the revision', () => {
  const clock = fixedClock()
  const saved = createSaved(DRAFT, clock)
  const next = renameSaved(saved, 'Kit v2', clock)

  expect(next.name).toBe('Kit v2')
  expect(next.id).toBe(saved.id)
  // Deliberate asymmetry, not an oversight. `revision` means "what this command emits
  // has changed", and a rename emits byte-identical text. Bumping it here would tell
  // every linked consumer to re-read a command that did not change.
  expect(next.revision).toBe(saved.revision)
  expect(next.updatedAt).not.toBe(saved.updatedAt)
})

test('the preview is a cache of the tree, not a second source of truth', () => {
  const clock = fixedClock()
  const saved = createSaved(DRAFT, clock)
  const next = reviseSaved(saved, { value: EMPTY_VALUE, preview: '/give @p diamond' }, clock)

  // Both fields move together in one call, so there is no API through which the cache
  // can be updated without the tree it projects — which is the only way it could go
  // stale within a session.
  expect(next.preview).toBe('/give @p diamond')
  expect(next.value).toBe(EMPTY_VALUE)
})

test('resumability compares traits, never version numbers', () => {
  const saved = createSaved(DRAFT, fixedClock())
  expect(resumability(saved, v1_21_1, findVersion)).toBe('ready')

  // A different *number* with identical traits still resumes. That is the whole claim
  // of the trait model: what a tree emits depends on how a version writes things, not
  // on where its number sorts. A comparison of version strings would answer this wrong.
  const twin: VersionDefinition = { ...v1_21_1, id: '1.21.3', mcmetaTag: '1.21.3-summary' }
  expect(resumability({ ...saved, version: twin.id }, v1_21_1, () => twin)).toBe('ready')

  // A version that writes enchantments differently does not, even though every other
  // trait matches — the tree survives, but what it emits does not.
  const flattened: VersionDefinition = {
    ...v1_21_1,
    id: '1.21.5',
    traits: { ...v1_21_1.traits, enchantmentsShape: 'flat' },
  }
  expect(resumability({ ...saved, version: flattened.id }, v1_21_1, () => flattened)).toBe(
    'retraited',
  )
})

test('a version this build has never heard of is reported as such', () => {
  const saved = createSaved({ ...DRAFT, version: '1.99.9' }, fixedClock())
  // Not "retraited", which would claim to know how that version writes things, and not
  // "ready", which would claim the tree is safe to open. There are no traits to
  // compare, so the honest answer is a third one.
  expect(resumability(saved, v1_21_1, findVersion)).toBe('unknown-version')
})

test('a restored tree resumes the instance counter above its highest id', () => {
  const value: CommandValue = {
    ...EMPTY_VALUE,
    repeats: { '/1': ['i0', 'i3', 'i1'], '/1/#i3/2': ['i7'] },
  }

  // 8, not 3 and not 0. The counter is global to the tree rather than per-Repeat, so
  // the deepest nested id counts; starting anywhere below it hands the next clause an
  // id another clause already holds, and two instances on one path is the failure the
  // generated-id model exists to prevent.
  expect(nextInstanceIdFor(value)).toBe(8)
})

test('seeded instance ids do not move the counter', () => {
  // `seed:n` is a separate id space, carrying its prefix precisely so it cannot
  // collide with a generated `iN`. Counting them would start the counter above ids
  // that were never drawn from it.
  expect(nextInstanceIdFor({ ...EMPTY_VALUE, repeats: { '/1': ['seed:0', 'seed:9'] } })).toBe(0)
  expect(nextInstanceIdFor(EMPTY_VALUE)).toBe(0)
})
