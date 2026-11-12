import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { Dashboard } from './Dashboard'
import { renderWithRouter } from '../test-router'
import { configureStorage, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { usePinnedGeneratorsStore } from '../stores/usePinnedGeneratorsStore'
import { useUiStore } from '../stores/useUiStore'
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

/** jsdom has no DataTransfer; a drag only needs somewhere to put its data. */
class DataTransferStub {
  effectAllowed = 'all'
  setData() {}
  getData() {
    return ''
  }
}

beforeEach(() => {
  backing = memoryStorage()
  configureStorage(localStorageBackend(backing))
  useSavedCommandsStore.setState({ commands: [], status: 'idle', error: null })
  // The panel layout is a *second* persisted thing, and it lives in the real jsdom
  // `localStorage` rather than in `backing`. Without this reset these tests would pass
  // or fail depending on what an earlier file happened to leave there, and a panel
  // closed by one test would hide another test's tiles.
  window.localStorage.clear()
  useDashboardStore.setState({
    collapsed: [],
    order: [],
    groups: [],
    hydrated: false,
  })
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
  expect(screen.getByRole('heading', { name: 'Linked to Konnekt' })).toBeDefined()

  // Each still says what would fill it, in one sentence and nothing else.
  expect(screen.getByText(/Nothing saved yet/)).toBeDefined()
  // And the way forward is where it now always is, rather than only on this screen.
  expect(screen.getByRole('link', { name: 'New command' }).getAttribute('href')).toBe('/c')
})

test('an empty panel draws nothing but its sentence', async () => {
  await renderWithRouter(<Dashboard />)
  await screen.findByRole('heading', { name: 'Saved commands' })

  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  const saved = screen.getByRole('heading', { name: 'Saved commands' }).closest('section')!
  expect(within(saved).queryByRole('list')).toBeNull()
  expect(within(saved).getByText(/Nothing saved yet/)).toBeDefined()
})

test('a panel closes, stays closed, and says which it is', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const toggle = await screen.findByRole('button', { name: 'Saved commands', expanded: true })
  await user.click(toggle)

  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(useDashboardStore.getState().collapsed).toEqual(['saved'])
  // The dashboard does not scroll, so a closed panel gives its room to its neighbours.
  const saved = screen.getByRole('heading', { name: 'Saved commands' }).closest('section')!
  expect(within(saved).queryAllByRole('listitem')).toHaveLength(0)

  await user.click(toggle)
  expect(within(saved).getAllByRole('listitem')).toHaveLength(1)
})

test('no panel offers maximize, and Add panel is gone', async () => {
  await renderWithRouter(<Dashboard />)
  await screen.findByRole('heading', { name: 'Saved commands' })

  expect(screen.queryByRole('button', { name: /Maximize/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Add panel/ })).toBeNull()
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

test('a saved command becomes a tile showing its cached text and save date', async () => {
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const tile = await screen.findByRole('listitem')
  expect(within(tile).getByRole('button', { name: 'Copy Starter kit' })).toBeDefined()
  // The `preview` string, not a re-serialization, which would need the skeletons.
  expect(within(tile).getByText('/give @p stone')).toBeDefined()
  expect(within(tile).getByText('1 Jan 2026')).toBeDefined()
})

test('clicking a tile copies its command and says so', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'Copy Starter kit' }))

  expect(await navigator.clipboard.readText()).toBe('/give @p stone')
  expect(screen.getByText('Copied')).toBeDefined()
  // Copying is not opening.
  expect(useUiStore.getState().origin).toBeNull()
})

test("a tile's controls are glyphs that still name the command they act on", async () => {
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const tile = await screen.findByRole('listitem')
  expect(within(tile).getByRole('button', { name: 'Edit Starter kit' })).toBeDefined()
  expect(within(tile).getByRole('button', { name: 'Delete Starter kit' })).toBeDefined()
  const pin = within(tile).getByRole('button', { name: 'Pin Starter kit' })
  expect(pin.getAttribute('aria-pressed')).toBe('false')
})

test('deleting a tile removes it from storage, not just from the screen', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'Delete Starter kit' }))

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

  // A warning icon carrying the reason, rather than a line of text on the tile.
  expect(await screen.findByText(/version this build does not know/)).toBeDefined()
})

test('the web build says what it cannot do rather than hiding the control', async () => {
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const link = await screen.findByRole('button', {
    name: /Link Starter kit into Konnekt: needs the desktop build/,
  })
  expect(link.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('1 saved')).toBeDefined()
})

test('the standalone build offers the same control live', async () => {
  // The positive control. Without it the test above passes just as well against a
  // control that is disabled unconditionally — which would be the same bug wearing the
  // fix, since the affordance would then never work anywhere.
  const file = localStorageBackend(backing)
  configureStorage({ ...file, kind: 'file' })
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  const link = await screen.findByRole('button', { name: 'Link Starter kit into Konnekt' })
  expect(link.hasAttribute('disabled')).toBe(false)
})

test('linking a saved command is what puts it in the Linked panel, and saving is not', async () => {
  const user = userEvent.setup()
  const file = localStorageBackend(backing)
  configureStorage({ ...file, kind: 'file' })
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  // Saved is not linked. Before this, every saved command was written into the file
  // Konnekt reads, which made "saved" and "shown in Konnekt" the same thing and left the
  // user no way to keep a command here without it appearing there.
  const linked = (await screen.findByRole('heading', { name: 'Linked to Konnekt' })).closest(
    'section',
  )!
  expect(within(linked).queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.getByText('1 saved · 0 linked')).toBeDefined()

  await user.click(screen.getByRole('button', { name: 'Link Starter kit into Konnekt' }))

  // The flag reaches the backend, because on the standalone build that write is what
  // projects the command into the shared file; a flag held only on screen links nothing.
  const [stored] = await file.list()
  expect(stored!.linked).toBe(true)
  expect(within(linked).getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('1 saved · 1 linked')).toBeDefined()

  // One glyph, two states: the control now says what is true and offers the way back.
  const toggle = screen.getAllByRole('button', { name: 'Unlink Starter kit from Konnekt' })[0]!
  expect(toggle.getAttribute('aria-pressed')).toBe('true')
  await user.click(toggle)
  expect(within(linked).queryAllByRole('listitem')).toHaveLength(0)
})

test('a tile says a tree will not restore before it is opened', async () => {
  // DRAFT carries a fingerprint that is not vanilla:give's, so the committed index
  // contradicts it.
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

test('edit opens the command in the generator, growing out of its tile', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'Edit Starter kit' }))

  expect(useUiStore.getState().origin?.key).toBe('uuid-1')
})

test('pressing a control on a tile does that control rather than opening it', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  // The two layers must not fight. Without the row stopping propagation, deleting a
  // command would also navigate into the editor for the record just removed.
  await user.click(await screen.findByRole('button', { name: 'Delete Starter kit' }))

  expect(screen.queryByRole('listitem')).toBeNull()
  expect(useUiStore.getState().origin).toBeNull()
})

test('dragging a tile onto another moves it there, and the order is kept', async () => {
  await seed(DRAFT, { ...DRAFT, name: 'Second' }, { ...DRAFT, name: 'Third' })
  await renderWithRouter(<Dashboard />)

  // Newest first: Third, Second, Starter kit.
  const tiles = await screen.findAllByRole('listitem')
  const names = () =>
    screen.getAllByRole('button', { name: /^Copy / }).map((b) => b.getAttribute('aria-label'))
  expect(names()).toEqual(['Copy Third', 'Copy Second', 'Copy Starter kit'])

  fireEvent.dragStart(tiles[2]!, { dataTransfer: new DataTransferStub() })
  fireEvent.dragOver(tiles[0]!, { dataTransfer: new DataTransferStub() })
  fireEvent.drop(tiles[0]!, { dataTransfer: new DataTransferStub() })

  expect(names()).toEqual(['Copy Starter kit', 'Copy Third', 'Copy Second'])
  expect(useDashboardStore.getState().order).toEqual(['uuid-1', 'uuid-3', 'uuid-2'])
})

test('the browser searches, filters by tag, and files a command under a group', async () => {
  const user = userEvent.setup()
  await seed(DRAFT, {
    ...DRAFT,
    name: 'Day',
    preview: '/time set day',
    definitionId: 'vanilla:time',
  })
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'Browse' }))
  act(() => useDashboardStore.getState().addGroup('Kits'))
  const browser = screen.getByRole('region', { name: 'Saved commands browser' })
  expect(within(browser).getByText('2 of 2')).toBeDefined()

  await user.type(within(browser).getByRole('textbox', { name: 'Search saved commands' }), 'time')
  expect(within(browser).getByText('1 of 2')).toBeDefined()
  await user.clear(within(browser).getByRole('textbox', { name: 'Search saved commands' }))

  // Tag one, then the chip filters on it.
  await user.click(within(browser).getByRole('button', { name: 'Tag Starter kit' }))
  await user.type(within(browser).getByRole('textbox', { name: 'New tag' }), 'PvP{Enter}')
  expect(useSavedCommandsStore.getState().commands.find((c) => c.id === 'uuid-1')!.tags).toEqual([
    'pvp',
  ])
  await user.click(within(browser).getByRole('button', { name: 'pvp', pressed: false }))
  expect(within(browser).getByText('1 of 2')).toBeDefined()
  await user.click(within(browser).getByRole('button', { name: 'pvp', pressed: true }))

  // Drag the row onto the Kits heading.
  const row = within(browser).getByRole('button', { name: 'Copy Starter kit' }).closest('li')!
  const kits = within(browser).getByRole('button', { name: 'Kits' }).closest('li')!
  fireEvent.dragStart(row, { dataTransfer: new DataTransferStub() })
  fireEvent.dragOver(kits, { dataTransfer: new DataTransferStub() })
  fireEvent.drop(kits, { dataTransfer: new DataTransferStub() })
  await waitFor(() =>
    expect(useSavedCommandsStore.getState().commands.find((c) => c.id === 'uuid-1')!.group).toBe(
      'Kits',
    ),
  )
})

test('the browser adds a group that nothing is filed under yet', async () => {
  const user = userEvent.setup()
  await seed(DRAFT)
  await renderWithRouter(<Dashboard />)

  await user.click(await screen.findByRole('button', { name: 'Browse' }))
  const browser = screen.getByRole('region', { name: 'Saved commands browser' })
  await user.click(within(browser).getByRole('button', { name: 'New group' }))
  await user.type(within(browser).getByRole('textbox', { name: 'New group' }), 'Events{Enter}')

  expect(within(browser).getByRole('button', { name: 'Events' })).toBeDefined()
  expect(useDashboardStore.getState().groups).toEqual(['Events'])
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
