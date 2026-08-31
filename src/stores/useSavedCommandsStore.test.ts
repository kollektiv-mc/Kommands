import { beforeEach, expect, test } from 'vitest'
import { configureStorage, useSavedCommandsStore } from './useSavedCommandsStore'
import { useCommandStore } from './useCommandStore'
import { localStorageBackend } from '../storage/local'
import type { SavedCommandStorage } from '../storage'
import { createSaved } from '../schema/saved'
import { fingerprintOf } from '../schema/fingerprint'
import { EXECUTE } from '../schema/fixtures'
import { NO_REGISTRIES } from '../data/versions/registry'
import { serializeCommand } from '../schema/serialize'
import type { SerializeContext } from '../data/versions/types'
import { v1_21_1 } from '../data/versions/1.21.1'
import { instance } from '../schema/paths'

const ctx: SerializeContext = { traits: v1_21_1.traits, registries: NO_REGISTRIES }

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

let backing: Storage

beforeEach(() => {
  backing = memoryStorage()
  configureStorage(localStorageBackend(backing))
  useSavedCommandsStore.setState({ commands: [], status: 'idle', error: null })
  useCommandStore.getState().reset()
})

const DRAFT = {
  name: 'Starter kit',
  definitionId: 'vanilla:give',
  version: v1_21_1.id,
  value: useCommandStore.getState().value,
  preview: '/give @p stone',
  fingerprint: 'fp-give',
}

test('saving, listing, renaming and removing', async () => {
  const store = useSavedCommandsStore.getState()

  const id = await store.create(DRAFT)
  expect(id).not.toBeNull()
  expect(useSavedCommandsStore.getState().commands).toHaveLength(1)

  await useSavedCommandsStore.getState().rename(id!, 'Kit v2')
  expect(useSavedCommandsStore.getState().commands[0]!.name).toBe('Kit v2')
  expect(useSavedCommandsStore.getState().commands[0]!.revision).toBe(1)

  await useSavedCommandsStore.getState().remove(id!)
  expect(useSavedCommandsStore.getState().commands).toHaveLength(0)
  // Gone from the backend too, not merely from the list in front of it.
  expect(await localStorageBackend(backing).list()).toHaveLength(0)
})

test('loading reads what a previous session wrote, newest first', async () => {
  // Written through the backend with timestamps a millisecond apart rather than saved
  // twice in a row. `create` stamps from the real clock, and two saves in one
  // millisecond is not an edge case here — it is what a test without a user between
  // them always produces, which would make this assert the tiebreak rather than the
  // sort it is about.
  const backend = localStorageBackend(backing)
  const base = createSaved(DRAFT, {
    now: () => '2026-01-01T00:00:00.000Z',
    uuid: () => 'uuid-older',
  })
  await backend.put(base)
  await backend.put(
    createSaved(
      { ...DRAFT, name: 'Second' },
      { now: () => '2026-01-01T00:00:01.000Z', uuid: () => 'uuid-newer' },
    ),
  )

  await useSavedCommandsStore.getState().load()

  const { commands, status } = useSavedCommandsStore.getState()
  expect(status).toBe('ready')
  expect(commands.map((c) => c.name)).toEqual(['Second', 'Starter kit'])
})

test('commands saved in the same millisecond keep a stable order', async () => {
  // Same timestamp, inserted in id order and then in reverse. Both reads must agree,
  // or a dashboard reshuffles between loads for no reason a user could explain.
  const at = '2026-01-01T00:00:00.000Z'
  const a = createSaved(DRAFT, { now: () => at, uuid: () => 'uuid-a' })
  const b = createSaved({ ...DRAFT, name: 'Second' }, { now: () => at, uuid: () => 'uuid-b' })

  const backend = localStorageBackend(backing)
  await backend.put(a)
  await backend.put(b)
  await useSavedCommandsStore.getState().load()
  const forwards = useSavedCommandsStore.getState().commands.map((c) => c.id)

  backing.clear()
  await backend.put(b)
  await backend.put(a)
  await useSavedCommandsStore.getState().load()

  expect(useSavedCommandsStore.getState().commands.map((c) => c.id)).toEqual(forwards)
})

test('no storage is a state the app reports, not an error it throws', async () => {
  // Safari's private browsing and any browser configured to block site data make even
  // reading window.localStorage throw. A generator that still generates is far more
  // useful than a blank page, so this has to be a state the UI can render.
  configureStorage(null)
  await useSavedCommandsStore.getState().load()

  expect(useSavedCommandsStore.getState().status).toBe('unavailable')
  expect(await useSavedCommandsStore.getState().create(DRAFT)).toBeNull()
})

test('a write that fails leaves no tile for a command that is not on disk', async () => {
  const refusing: SavedCommandStorage = {
    kind: 'local',
    list: async () => [],
    put: async () => {
      throw new Error('QuotaExceededError')
    },
    remove: async () => {},
  }
  configureStorage(refusing)

  expect(await useSavedCommandsStore.getState().create(DRAFT)).toBeNull()
  // The alternative — adding it optimistically — survives exactly until the next
  // reload, and the user has no way to tell which of their saved commands were real.
  expect(useSavedCommandsStore.getState().commands).toHaveLength(0)
  expect(useSavedCommandsStore.getState().error).toContain('QuotaExceededError')
})

test('a value tree survives a save, a reload, and resumed editing', async () => {
  const commands = useCommandStore.getState()

  // Build a two-clause /execute through the real actions, so the instance ids are the
  // ones the store hands out rather than ids a fixture chose.
  commands.addInstance('/1', { min: 0 })
  commands.addInstance('/1', { min: 0 })
  const [first, second] = useCommandStore.getState().value.repeats['/1']!
  useCommandStore.getState().setChoice(instance('/1', first!), 0)
  useCommandStore.getState().setChoice(instance('/1', second!), 1)
  useCommandStore.getState().setArg(`${instance('/1', first!)}/|0/1`, '@a')
  useCommandStore.getState().setArg(`${instance('/1', second!)}/|1/1`, '@s')

  const before = serializeCommand(EXECUTE, useCommandStore.getState().value, ctx)
  expect(before).toBe('/execute as @a at @s')

  await useSavedCommandsStore.getState().create({
    name: 'Two clauses',
    definitionId: EXECUTE.id,
    version: v1_21_1.id,
    value: useCommandStore.getState().value,
    preview: before,
    fingerprint: fingerprintOf(EXECUTE),
  })

  // The session ends: the value tree and its id counter both go.
  useCommandStore.getState().reset()
  useSavedCommandsStore.setState({ commands: [], status: 'idle' })
  await useSavedCommandsStore.getState().load()

  const saved = useSavedCommandsStore.getState().commands[0]!
  useCommandStore.getState().load(saved.value)

  // The command text is the same one, byte for byte — which is the property that makes
  // storing the tree rather than the text worth its cost.
  expect(serializeCommand(EXECUTE, useCommandStore.getState().value, ctx)).toBe(before)

  // And editing resumes: a third clause gets an id neither restored clause holds. With
  // the counter left at zero this would be `i0` again, putting two clauses on one path
  // — the failure the generated-id model exists to prevent, and one that shows up as
  // one clause's edits appearing in another rather than as an error.
  useCommandStore.getState().addInstance('/1', { min: 0 })
  const ids = useCommandStore.getState().value.repeats['/1']!
  expect(ids).toHaveLength(3)
  expect(new Set(ids).size).toBe(3)

  useCommandStore.getState().setChoice(instance('/1', ids[2]!), 0)
  useCommandStore.getState().setArg(`${instance('/1', ids[2]!)}/|0/1`, '@e')
  expect(serializeCommand(EXECUTE, useCommandStore.getState().value, ctx)).toBe(
    '/execute as @a at @s as @e',
  )
})
