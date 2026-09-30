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

/** Open the name popover and save under `name`. */
async function saveAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Save…' }))
  await user.type(screen.getByRole('textbox', { name: 'Save as' }), name)
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

/** The description a menu item's reason is given as. */
const reasonOf = (el: HTMLElement) =>
  document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent

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

  await saveAs(user, 'Starter kit')

  const [saved] = await localStorageBackend(backing).list()
  expect(saved!.name).toBe('Starter kit')
  expect(saved!.definitionId).toBe('vanilla:give')
  // Both, in one write. The tree is what an edit resumes from; the text is the cache a
  // dashboard tile reads so it need not load the skeletons and registries to draw one.
  expect(saved!.value).toEqual(EMPTY_VALUE)
  expect(saved!.preview).toBe('/give @p stone')
  expect(saved!.revision).toBe(1)
  // The popover has done its job and closes, and the receipt says so.
  expect(screen.queryByRole('textbox', { name: 'Save as' })).toBeNull()
  expect(screen.getByText('Saved')).toBeDefined()
})

test('a command with no name cannot be saved, and Escape leaves without saving', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))

  await user.click(await screen.findByRole('button', { name: 'Save…' }))
  // A nameless tile is unfindable on a dashboard, so the control that would create one
  // is not offered rather than creating one called "".
  expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)

  const field = screen.getByRole('textbox', { name: 'Save as' })
  // Focus lands in the field, so opening the popover and typing is one gesture.
  expect(document.activeElement).toBe(field)
  await user.type(field, 'Kit')
  expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false)

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('textbox', { name: 'Save as' })).toBeNull()
  expect(await localStorageBackend(backing).list()).toHaveLength(0)
})

test('an empty command offers no save, and says nothing about it', async () => {
  await renderWithRouter(bar(''))

  // Not an error and not a warning: a command nobody has started is the ordinary state
  // of a page that has just been opened.
  expect(await screen.findByRole('button', { name: 'Save…' })).toHaveProperty('disabled', true)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('editing a saved command updates it in place rather than making a second copy', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await saveAs(user, 'Starter kit')

  const [first] = await localStorageBackend(backing).list()

  // Re-rendered as the route would after the save puts `?saved=<id>` in the URL.
  await renderWithRouter(bar('/give @p diamond', first!.id))
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))

  const listed = await localStorageBackend(backing).list()
  expect(listed).toHaveLength(1)
  // Same id, so every link pointing at it still resolves, and a bumped revision, which
  // is how a linked consumer tells "I have seen this" from "this changed".
  expect(listed[0]!.id).toBe(first!.id)
  expect(listed[0]!.revision).toBe(2)
  expect(listed[0]!.preview).toBe('/give @p diamond')
})

test('re-saving a command nobody has touched is offered as the no-op it is', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await saveAs(user, 'Starter kit')

  const [first] = await localStorageBackend(backing).list()

  // Reopened with the command exactly as it was stored, which is what a tile click
  // produces. The control is present and disabled with the reason in its accessible
  // name, rather than reporting success for a save that would change nothing and bump
  // a revision every linked consumer would re-read for.
  await renderWithRouter(bar('/give @p stone', first!.id))
  const idle = await screen.findByRole('button', {
    name: /Save changes: nothing has changed since the last save/,
  })
  expect(idle).toHaveProperty('disabled', true)

  // And it comes back the moment the command does change.
  await renderWithRouter(bar('/give @p diamond', first!.id))
  expect(await screen.findByRole('button', { name: 'Save changes' })).toHaveProperty(
    'disabled',
    false,
  )
})

test('with storage off it says so instead of offering a control that cannot work', async () => {
  configureStorage(null)
  await renderWithRouter(bar('/give @p stone'))

  expect(await screen.findByRole('button', { name: /^Saving is off/ })).toHaveProperty(
    'disabled',
    true,
  )
  expect(screen.queryByRole('button', { name: 'Save…' })).toBeNull()
})

test('the three tile verbs are here too, disabled until there is a command to act on', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await user.click(await screen.findByRole('button', { name: 'More' }))

  // Present and disabled with the reason beside them, rather than appearing the moment
  // a save succeeds. distribution.md § The split must be visible names the failure:
  // learning a thing exists by finding nothing where you expected something.
  for (const name of ['Rename', 'Pin to Quick']) {
    const item = screen.getByRole('button', { name })
    expect(item).toHaveProperty('disabled', true)
    expect(reasonOf(item)).toBe('Save first')
  }
  // link states the *build* reason, because that one is permanent and the other is
  // not: a web session will never link however much it saves.
  const linkItem = screen.getByRole('button', { name: 'Link to Konnekt' })
  expect(linkItem).toHaveProperty('disabled', true)
  expect(reasonOf(linkItem)).toBe('Desktop app only')
})

test('pinning from the editor is the same pin the dashboard shows', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await saveAs(user, 'Starter kit')

  const [saved] = await localStorageBackend(backing).list()
  const { container } = await renderWithRouter(bar('/give @p stone', saved!.id))
  const editor = within(container)

  await user.click(await editor.findByRole('button', { name: 'More' }))
  await user.click(editor.getByRole('button', { name: 'Pin to Quick' }))

  // One flag, two places. Quick on the dashboard reads this, so pinning here has to
  // reach the same record rather than a second notion of pinned.
  const [after] = await localStorageBackend(backing).list()
  expect(after!.pinned).toBe(true)
  await user.click(editor.getByRole('button', { name: 'More' }))
  expect(await editor.findByRole('button', { name: 'Unpin from Quick' })).toBeDefined()
})

test('linking from the editor is the same link the dashboard shows', async () => {
  const user = userEvent.setup()
  // The standalone backend, which is the only one whose writes reach Konnekt.
  const file = localStorageBackend(backing)
  configureStorage({ ...file, kind: 'file' })
  await renderWithRouter(bar('/give @p stone'))
  await saveAs(user, 'Starter kit')

  const [saved] = await file.list()
  const { container } = await renderWithRouter(bar('/give @p stone', saved!.id))
  const editor = within(container)

  await user.click(await editor.findByRole('button', { name: 'More' }))
  await user.click(editor.getByRole('button', { name: 'Link to Konnekt' }))

  // One flag, two places, exactly as the pin: the Linked panel reads this, and so does
  // the projection that decides what Konnekt sees.
  const [after] = await file.list()
  expect(after!.linked).toBe(true)
  expect(after!.revision).toBe(1)
  await user.click(editor.getByRole('button', { name: 'More' }))
  expect(await editor.findByRole('button', { name: 'Unlink from Konnekt' })).toBeDefined()
})

test('rename opens the same popover, seeded with the current name', async () => {
  const user = userEvent.setup()
  await renderWithRouter(bar('/give @p stone'))
  await saveAs(user, 'Starter kit')

  const [saved] = await localStorageBackend(backing).list()
  // Scoped to this render. The first one is still mounted (cleanup runs between tests,
  // not between renders) and its own controls would answer an unscoped query.
  const { container } = await renderWithRouter(bar('/give @p stone', saved!.id))
  const editor = within(container)

  // A saved command shows Save changes and no field until one is asked for.
  expect(editor.queryByRole('textbox')).toBeNull()
  await user.click(await editor.findByRole('button', { name: 'More' }))
  await user.click(editor.getByRole('button', { name: 'Rename' }))

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
