import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { SaveCommandBar } from './SaveCommandBar'
import { renderWithRouter } from '../test-router'
import { configureStorage, useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { localStorageBackend } from '../storage/local'
import { EMPTY_VALUE } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { CommandDefinition } from '../schema/types'

const GIVE: CommandDefinition = {
  id: 'vanilla:give',
  label: '/give',
  dialect: 'vanilla',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  root: { kind: 'sequence', nodes: [{ kind: 'literal', token: 'give' }] },
}

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
})

function bar(output: string, savedId?: string) {
  return (
    <SaveCommandBar
      definition={GIVE}
      version={v1_21_1}
      value={EMPTY_VALUE}
      output={output}
      savedId={savedId}
    />
  )
}

test('saving writes the tree and the rendered text together', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))

  await user.type(await screen.findByRole('textbox', { name: 'Save as' }), 'Starter kit')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const [saved] = await localStorageBackend(backing).list()
  expect(saved!.name).toBe('Starter kit')
  expect(saved!.definitionId).toBe('vanilla:give')
  // Both, in one write. The tree is what an edit resumes from; the text is the cache a
  // dashboard tile reads so it need not load the skeletons and registries to draw one.
  expect(saved!.value).toEqual(EMPTY_VALUE)
  expect(saved!.preview).toBe('/give @p stone')
  expect(saved!.revision).toBe(1)
})

test('a command with no name and a command with no output cannot be saved', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))

  // A nameless tile is unfindable on a dashboard, so the control that would create one
  // is not offered rather than creating one called "".
  expect(await screen.findByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)

  await user.type(screen.getByRole('textbox', { name: 'Save as' }), 'Kit')
  expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false)
})

test('an empty command offers no save, and says nothing about it', async () => {
  await renderWithRouter(bar(''))

  // Not an error and not a warning: a command nobody has started is the ordinary state
  // of a page that has just been opened.
  expect(await screen.findByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('editing a saved command updates it in place rather than making a second copy', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await user.type(await screen.findByRole('textbox', { name: 'Save as' }), 'Starter kit')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const [first] = await localStorageBackend(backing).list()

  // Re-rendered as the route would after the save puts `?saved=<id>` in the URL.
  await renderWithRouter(bar('/give @p diamond', first!.id))
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))

  const listed = await localStorageBackend(backing).list()
  expect(listed).toHaveLength(1)
  // Same id — every link pointing at it still resolves — and a bumped revision, which
  // is how a linked consumer tells "I have seen this" from "this changed".
  expect(listed[0]!.id).toBe(first!.id)
  expect(listed[0]!.revision).toBe(2)
  expect(listed[0]!.preview).toBe('/give @p diamond')
})

test('with storage off it says so instead of offering a control that cannot work', async () => {
  configureStorage(null)
  await renderWithRouter(bar('/give @p stone'))

  expect(await screen.findByText(/Saving is off/)).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
})

test('the three tile verbs are here too, disabled until there is a command to act on', async () => {
  await renderWithRouter(bar('/give @p stone'))

  // Present and disabled with the reason in the accessible name, rather than appearing
  // the moment a save succeeds. distribution.md § The split must be visible names the
  // failure: learning a thing exists by finding nothing where you expected something.
  for (const name of [/^pin — save the command first/, /^rename — save the command first/]) {
    expect(await screen.findByRole('button', { name })).toHaveProperty('disabled', true)
  }
  // link states the *build* reason first, because that one is permanent and the other
  // is not — a web session will never link however much it saves.
  expect(
    await screen.findByRole('button', { name: /^link — needs the desktop build/ }),
  ).toHaveProperty('disabled', true)
})

test('pinning from the editor is the same pin the dashboard shows', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await user.type(await screen.findByRole('textbox', { name: 'Save as' }), 'Starter kit')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const [saved] = await localStorageBackend(backing).list()
  await renderWithRouter(bar('/give @p stone', saved!.id))

  await user.click(await screen.findByRole('button', { name: 'pin' }))

  // One flag, two places. Quick on the dashboard reads this, so pinning here has to
  // reach the same record rather than a second notion of pinned.
  const [after] = await localStorageBackend(backing).list()
  expect(after!.pinned).toBe(true)
  expect(await screen.findByRole('button', { name: 'pinned' })).toBeDefined()
})

test('rename reuses the one field rather than growing a second one', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await user.type(await screen.findByRole('textbox', { name: 'Save as' }), 'Starter kit')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const [saved] = await localStorageBackend(backing).list()
  // Scoped to this render. The first one is still mounted — cleanup runs between
  // tests, not between renders — and its own name field would answer a bare
  // `queryByRole('textbox')` and make the assertion below meaningless.
  const { container } = await renderWithRouter(bar('/give @p stone', saved!.id))
  const editor = within(container)

  // A saved command shows its name and a Save changes button, with no field at all —
  // the block is two rows and stays two rows.
  expect(editor.queryByRole('textbox')).toBeNull()
  await user.click(await editor.findByRole('button', { name: 'rename' }))

  const field = await editor.findByRole('textbox', { name: 'Rename' })
  // Seeded with the current name: a rename is usually an edit of what is there, and an
  // empty field makes someone retype it to change one word.
  expect((field as HTMLInputElement).value).toBe('Starter kit')
  await user.clear(field)
  await user.type(field, 'Kit v2')
  await user.click(editor.getByRole('button', { name: 'Rename' }))

  const [renamed] = await localStorageBackend(backing).list()
  expect(renamed!.name).toBe('Kit v2')
  // A rename emits byte-identical command text, so bumping the revision would tell
  // every linked consumer to re-read a command that did not change.
  expect(renamed!.revision).toBe(1)
})
