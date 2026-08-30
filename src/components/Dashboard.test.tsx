import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { Dashboard } from './Dashboard'
import { renderWithRouter } from '../test-router'
import { configureStorage, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { localStorageBackend } from '../storage/local'
import { createSaved, type SavedCommandDraft } from '../schema/saved'
import { EMPTY_VALUE } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'

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
  configureStorage(localStorageBackend(backing))
  useSavedCommandsStore.setState({ commands: [], status: 'idle', error: null })
})

async function seed(...drafts: SavedCommandDraft[]) {
  const backend = localStorageBackend(backing)
  let tick = 0
  for (const draft of drafts) {
    tick += 1
    await backend.put(
      createSaved(draft, {
        now: () => `2026-01-0${tick}T00:00:00.000Z`,
        uuid: () => `uuid-${tick}`,
      }),
    )
  }
}

test('with nothing saved, it points at the generator instead of showing an empty grid', async () => {
  await renderWithRouter(<Dashboard />)

  expect(await screen.findByText(/Nothing saved yet/)).toBeDefined()
  // The empty state is the first thing most visitors see, so it has to lead somewhere.
  // A grid with no tiles and no way forward is where the placeholder page failed.
  expect(screen.getByRole('link', { name: 'New command' }).getAttribute('href')).toBe('/c')
})

test('a saved command becomes a tile showing its cached text', async () => {
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const tile = await screen.findByRole('listitem')
  expect(within(tile).getByRole('button', { name: 'Starter kit' })).toBeDefined()
  // The `preview` string, not a re-serialization. Drawing this from the value tree
  // would mean pulling the command skeletons and registries on the app's first screen.
  expect(within(tile).getByText('/give @p stone')).toBeDefined()
})

test('renaming a tile keeps its revision', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'rename' }))
  const field = screen.getByRole('textbox', { name: 'Name' })
  await user.clear(field)
  await user.type(field, 'Kit v2')
  await user.click(screen.getByRole('button', { name: 'Rename' }))

  expect(await screen.findByRole('button', { name: 'Kit v2' })).toBeDefined()
  // A rename emits byte-identical command text, so bumping the revision would tell
  // every linked consumer to re-read a command that did not change.
  expect(useSavedCommandsStore.getState().commands[0]!.revision).toBe(1)
})

test('deleting a tile removes it from storage, not just from the screen', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'delete' }))

  expect(screen.queryByRole('listitem')).toBeNull()
  expect(await localStorageBackend(backing).list()).toHaveLength(0)
})

test('storage being off is a state with a way forward, not an error screen', async () => {
  configureStorage(null)
  await renderWithRouter(<Dashboard />)

  // A browser refusing site data still has a working generator. Saying so and offering
  // the generator is a smaller failure than the blank page a throw would produce.
  expect(await screen.findByText(/not letting the page store anything/)).toBeDefined()
  expect(screen.getByRole('link', { name: 'Open the generator' })).toBeDefined()
})

test('a command authored for an unknown version says so on its tile', async () => {
  await seed({ ...DRAFT, version: '1.99.9' })
  await renderWithRouter(<Dashboard />)

  // Not hidden and not silently opened. There are no traits to compare against, so the
  // tile makes the uncertainty visible rather than implying the command is fine.
  expect(await screen.findByText(/version this build does not know/)).toBeDefined()
})
