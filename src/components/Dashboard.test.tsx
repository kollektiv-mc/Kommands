import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { Dashboard } from './Dashboard'
import { renderWithRouter } from '../test-router'
import { configureStorage, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { usePinnedGeneratorsStore } from '../stores/usePinnedGeneratorsStore'
import { useUiStore } from '../stores/useUiStore'
import { DEFAULT_PLACED } from './dashboard/panels'
import { localStorageBackend } from '../storage/local'
import { createSaved, type SavedCommandDraft } from '../schema/saved'
import { EMPTY_VALUE } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'
import { loadFingerprints } from '../data/loadGenerated'

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
  // The panel layout is a *second* persisted thing, and it lives in the real jsdom
  // `localStorage` rather than in `backing`. Without this reset these tests would pass
  // or fail depending on what an earlier file happened to leave there — and a panel
  // removed by one test would hide another test's tiles.
  window.localStorage.clear()
  useDashboardStore.setState({ placed: DEFAULT_PLACED, removed: [], hydrated: false })
  // A *third* persisted thing, on its own key. `hydrated` has to be reset with the
  // rest or the second test in this file reads the first one's pins out of a store
  // that believes it has already loaded.
  usePinnedGeneratorsStore.setState({ pinned: [], hydrated: false })
  useUiStore.setState({ origin: null })
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

test('with nothing saved, the organizers are still there rather than replaced by a splash', async () => {
  await renderWithRouter(<Dashboard />)

  // There used to be a full-page hero here — wordmark, sentence, button — shown
  // whenever nothing was saved. It hid the dashboard's whole shape from exactly the
  // person who had never seen it, so the organizers were a thing you discovered by
  // saving something first.
  expect(await screen.findByRole('heading', { name: 'Pinned generators' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Saved commands' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Recent' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Quick' })).toBeDefined()

  // Each still says what would fill it. The empty slots show there is room; only the
  // sentence can say what the room is for.
  expect(screen.getByText(/Nothing saved yet/)).toBeDefined()
  // And the way forward is where it now always is, rather than only on this screen.
  expect(screen.getByRole('link', { name: 'New command' }).getAttribute('href')).toBe('/c')
})

test('empty slots are drawn but not announced', async () => {
  await renderWithRouter(<Dashboard />)
  await screen.findByRole('heading', { name: 'Saved commands' })

  // Four organizers × five slots are in the markup, and none of them is a listitem.
  // A screen reader counting twenty empty entries before the first real one would make
  // an empty dashboard worse to navigate than a blank box — which is why the slots are
  // aria-hidden, and why `getByRole('listitem')` still means "a command" everywhere
  // else in this file.
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('a pinned generator becomes a tile that opens its editor', async () => {
  usePinnedGeneratorsStore.setState({
    pinned: [{ id: 'vanilla:give', label: '/give' }],
    hydrated: true,
  })
  await renderWithRouter(<Dashboard />)

  const tile = await screen.findByRole('listitem')
  // The label is the snapshot taken at pin time, never resolved from the catalogue:
  // the dashboard does not load the 560 KB of command skeletons and must not start.
  const link = within(tile).getByRole('link', { name: '/give' })
  expect(link.getAttribute('href')).toBe('/c/vanilla%3Agive')
})

test('unpinning a generator empties the panel and the storage behind it', async () => {
  const user = userEvent.setup()
  usePinnedGeneratorsStore.setState({
    pinned: [{ id: 'vanilla:give', label: '/give' }],
    hydrated: true,
  })
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'Unpin /give' }))

  expect(screen.queryByRole('listitem')).toBeNull()
  expect(usePinnedGeneratorsStore.getState().pinned).toEqual([])
})

test('a pinned generator is not the same thing as a pinned command', async () => {
  // Quick holds finished commands someone wants again; Pinned generators holds the
  // commands they build often. Collapsing the two onto SavedCommand.pinned would break
  // the first time someone pinned a generator they had never saved from — so the two
  // panels must not answer each other's question.
  await seed(DRAFT)
  usePinnedGeneratorsStore.setState({
    pinned: [{ id: 'vanilla:give', label: '/give' }],
    hydrated: true,
  })
  await renderWithRouter(<Dashboard />)

  const quick = (await screen.findByRole('heading', { name: 'Quick' })).closest('section')!
  const generators = screen.getByRole('heading', { name: 'Pinned generators' }).closest('section')!

  expect(within(generators).getAllByRole('listitem')).toHaveLength(1)
  expect(within(quick).queryAllByRole('listitem')).toHaveLength(0)
})

test('the maximize control is present and says it does nothing yet', async () => {
  await renderWithRouter(<Dashboard />)

  // Present and disabled rather than absent — the same call SavedCommandTile makes for
  // the Konnekt link, and for the reason distribution.md § The split must be visible
  // gives: someone learning a thing is missing by finding nothing where they expected
  // something. The reason lives in the accessible name, not only in a tooltip.
  const maximize = await screen.findByRole('button', {
    name: /Maximize Saved commands — not yet available/,
  })
  expect(maximize.hasAttribute('disabled')).toBe(true)
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

test('the web build says what it cannot do rather than hiding the control', async () => {
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  // Present and disabled, not absent. `distribution.md` § The split must be visible
  // names the failure this guards against: a user learning that linking is
  // standalone-only by finding nothing where they expected something.
  const link = await screen.findByRole('button', { name: /link — needs the desktop build/ })
  expect(link.hasAttribute('disabled')).toBe(true)
  // And the reason is readable without hovering anything.
  expect(screen.getByText(/needs the standalone build/)).toBeDefined()
})

test('the standalone build offers the same control live', async () => {
  // The positive control. Without it the test above passes just as well against a
  // control that is disabled unconditionally — which would be the same bug wearing the
  // fix, since the affordance would then never work anywhere.
  const file = localStorageBackend(backing)
  configureStorage({ ...file, kind: 'file' })
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const link = await screen.findByRole('button', { name: 'link' })
  expect(link.hasAttribute('disabled')).toBe(false)
  expect(screen.queryByText(/needs the standalone build/)).toBeNull()
})

test('a tile says a tree will not restore before it is opened', async () => {
  // DRAFT carries a fingerprint that is not vanilla:give's, so the committed index
  // contradicts it. Before the index existed this could only be discovered by opening
  // the command — the tile had no catalogue and the editor had the only answer.
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  expect(await screen.findByText(/older shape of this command/)).toBeDefined()
})

test('a tile whose fingerprint matches the index says nothing structural', async () => {
  // The negative control. Without it the test above passes equally well against a tile
  // that calls every saved command stale, which would train the user to ignore it.
  const index = await loadFingerprints(v1_21_1)
  await seed({ ...DRAFT, fingerprint: index['vanilla:give'] as string })
  await renderWithRouter(<Dashboard />)

  // The tile is there…
  expect(await screen.findByText('Starter kit')).toBeDefined()
  // …and says nothing about its shape.
  expect(screen.queryByText(/older shape of this command/)).toBeNull()
  expect(screen.queryByText(/Saved before Kommands recorded/)).toBeNull()
})

test('the whole tile opens the command, not only its name', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  // The command text, which is the largest thing on a tile and was dead to a click.
  // The doc comment claimed the whole tile was the control long before it was.
  await user.click(await screen.findByText('/give @p stone'))

  expect(useUiStore.getState().origin?.key).toBe('uuid-1')
})

test('pressing a control on a tile does that control rather than opening it', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  // The two layers must not fight. Without the row stopping propagation, deleting a
  // command would also navigate into the editor for the record just removed.
  await user.click(await screen.findByRole('button', { name: 'delete' }))

  expect(screen.queryByRole('listitem')).toBeNull()
  expect(useUiStore.getState().origin).toBeNull()
})

test('selecting the command text does not open the editor', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  // A drag that highlights text ends in a click on the common ancestor. Without this
  // guard the preview text would be unselectable in practice — and this app's whole
  // product is a string you copy somewhere else.
  const selection = window.getSelection
  window.getSelection = () => ({ toString: () => '/give @p' }) as unknown as Selection
  try {
    await user.click(await screen.findByText('/give @p stone'))
  } finally {
    window.getSelection = selection
  }

  expect(useUiStore.getState().origin).toBeNull()
})

test('a pinned generator tile is one link from edge to edge', async () => {
  usePinnedGeneratorsStore.setState({
    pinned: [{ id: 'vanilla:give', label: '/give' }],
    hydrated: true,
  })
  await renderWithRouter(<Dashboard />)

  // Stretched over the tile rather than wrapping the label, so the target is the tile.
  // A link rather than a click handler, unlike SavedCommandTile, because there is no
  // text here worth selecting and a link keeps middle-click and open-in-new-tab.
  const tile = await screen.findByRole('listitem')
  const link = within(tile).getByRole('link', { name: '/give' })
  expect(link.className).toContain('absolute')
  expect(link.className).toContain('inset-0')
})
