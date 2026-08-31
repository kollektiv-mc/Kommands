import { beforeEach, expect, test } from 'vitest'
import { STORAGE_KEY, localStorageBackend } from './local'
import { FORMAT_VERSION } from './types'
import { createSaved, renameSaved, type SaveClock, type SavedCommandDraft } from '../schema/saved'
import { EMPTY_VALUE } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'

/** A `Storage` that is real enough to test against, without touching the global one. */
function memoryStorage(): Storage {
  const held = new Map<string, string>()
  return {
    get length() {
      return held.size
    },
    clear: () => held.clear(),
    getItem: (key) => held.get(key) ?? null,
    key: (index) => [...held.keys()][index] ?? null,
    removeItem: (key) => void held.delete(key),
    setItem: (key, value) => void held.set(key, value),
  }
}

function clock(seed: number): SaveClock {
  let tick = seed
  return { now: () => `2026-01-0${tick++}T00:00:00.000Z`, uuid: () => `uuid-${tick}` }
}

const DRAFT: SavedCommandDraft = {
  name: 'Starter kit',
  definitionId: 'vanilla:give',
  version: v1_21_1.id,
  value: EMPTY_VALUE,
  preview: '/give @p stone',
  fingerprint: 'fp-give',
}

let backing: Storage

beforeEach(() => {
  backing = memoryStorage()
})

test('a saved command survives a round trip', async () => {
  const store = localStorageBackend(backing)
  const saved = createSaved(DRAFT, clock(1))

  await store.put(saved)
  expect(await store.list()).toEqual([saved])
})

test('putting the same id twice replaces rather than duplicates', async () => {
  const store = localStorageBackend(backing)
  const saved = createSaved(DRAFT, clock(1))

  await store.put(saved)
  await store.put({ ...saved, name: 'Renamed', revision: 2 })

  const listed = await store.list()
  expect(listed).toHaveLength(1)
  expect(listed[0]!.name).toBe('Renamed')
})

test('removing an id that is not there is not an error', async () => {
  const store = localStorageBackend(backing)
  await store.put(createSaved(DRAFT, clock(1)))

  await store.remove('not-a-real-id')
  expect(await store.list()).toHaveLength(1)
})

test('an empty store reads as no commands, not as a failure', async () => {
  expect(await localStorageBackend(backing).list()).toEqual([])
})

test('a corrupt blob costs the commands, not the app', async () => {
  backing.setItem(STORAGE_KEY, '{ this is not json')

  // Throwing here would take the dashboard down with the data, leaving no way back to
  // a working app short of clearing site data by hand. Losing the list is bad; losing
  // the list *and* the app is worse.
  expect(await localStorageBackend(backing).list()).toEqual([])
})

test('a newer format version still yields the entries it can read', async () => {
  const saved = createSaved(DRAFT, clock(1))
  backing.setItem(STORAGE_KEY, JSON.stringify({ version: FORMAT_VERSION + 1, commands: [saved] }))

  // This assertion is the inverse of the one it replaces, and the reversal is the
  // point. The old rule refused a whole file whose envelope version it did not
  // recognise; `health-checklist.md` now requires a reader to skip an entry it does not
  // understand rather than reject the file, because one build refusing another's file
  // empties the dashboard silently — and on the standalone backend that file is the one
  // Konnekt reads.
  expect(await localStorageBackend(backing).list()).toEqual([saved])
})

test('a field this build has never heard of survives a read, an edit and a write', async () => {
  // The property that makes per-entry acceptance safe rather than a gamble, and the one
  // the old whole-file refusal was written to protect. It holds structurally: `read`
  // *filters* rather than maps, so it returns the parsed objects with their unknown keys
  // intact, `write` stringifies them whole, and every mutation in `saved.ts` is a spread.
  const store = localStorageBackend(backing)
  const saved = createSaved(DRAFT, clock(1))
  const fromTheFuture = { ...saved, somethingNew: 'from a later build' }
  backing.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: FORMAT_VERSION, commands: [fromTheFuture] }),
  )

  const [read] = await store.list()
  expect((read as unknown as Record<string, unknown>).somethingNew).toBe('from a later build')

  // And it survives being written back, which is where the loss would actually happen.
  await store.put(renameSaved(read!, 'Renamed'))
  const [after] = await store.list()
  expect((after as unknown as Record<string, unknown>).somethingNew).toBe('from a later build')
  expect(after!.name).toBe('Renamed')
})

test('an entry saved before fingerprints existed still loads', async () => {
  // A version-1 record has no `fingerprint`. Dropping it would be the reader rejecting
  // what it does not recognise; it loads, and `structureState` reports it as
  // `unverified` rather than as a match.
  const store = localStorageBackend(backing)
  const { fingerprint: _dropped, ...withoutFingerprint } = createSaved(DRAFT, clock(1))
  backing.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: FORMAT_VERSION, commands: [withoutFingerprint] }),
  )

  const listed = await store.list()
  expect(listed).toHaveLength(1)
  expect(listed[0]!.fingerprint).toBeUndefined()
})

test('an entry of the wrong shape is dropped and its neighbours survive', async () => {
  const good = createSaved(DRAFT, clock(1))
  backing.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: FORMAT_VERSION,
      commands: [good, { id: 'half-written', name: 'no tree here' }],
    }),
  )

  // Per-entry rather than all-or-nothing: one half-written record should not cost the
  // user every other command they saved.
  expect(await localStorageBackend(backing).list()).toEqual([good])
})

test('a failed write rejects rather than throwing past the caller', async () => {
  const refusing: Storage = {
    ...memoryStorage(),
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }

  // The distinction matters: a synchronous throw out of a method that returns a
  // promise escapes the caller's `.catch()` entirely, and the store slice would report
  // a save that never happened.
  await expect(localStorageBackend(refusing).put(createSaved(DRAFT, clock(1)))).rejects.toThrow(
    'QuotaExceededError',
  )
})
