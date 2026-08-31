import { act, render, screen } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { beforeEach, expect, test } from 'vitest'
import { CommandEditor } from './CommandEditor'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { makeRegistryLookup } from '../data/versions/registry'
import { v1_21_1 } from '../data/versions/1.21.1'
import { fingerprintOf } from '../schema/fingerprint'
import type { CommandDefinition } from '../schema/types'
import type { SavedCommand } from '../schema/saved'
import { EMPTY_VALUE, type CommandValue } from '../schema/serialize'
import { useCommandStore } from '../stores/useCommandStore'
import { configureStorage, useSavedCommandsStore } from '../stores/useSavedCommandsStore'

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
const GIVE = commands['vanilla:give']!
const catalogue = { 'vanilla:give': GIVE }
const registries = makeRegistryLookup({ item: ['stone'], enchantment: [] })

/**
 * A saved tree with something visible in it.
 *
 * `/2` is the item argument — third child of `/give`'s root sequence, and `child()`
 * numbers from zero. Hardcoded rather than derived because the point of the test is to
 * notice if it stops arriving, and a path computed from the same definition the
 * component reads would move with it silently.
 */
const STALE_TREE: CommandValue = {
  ...EMPTY_VALUE,
  args: { '/2': { id: 'stone', components: {} } },
}

function savedCommand(overrides: Partial<SavedCommand>): SavedCommand {
  return {
    id: 'saved-1',
    name: 'Starter kit',
    definitionId: 'vanilla:give',
    version: v1_21_1.id,
    value: STALE_TREE,
    preview: '/give @p minecraft:stone',
    revision: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * The route tree the editor actually addresses.
 *
 * Not `test-router.tsx`'s stand-in: `getRouteApi('/dashboard/c/$commandId')` resolves a
 * route **id**, and the pathless layout route is what puts `dashboard` in front of a
 * path that is still `/c/$commandId`. A tree with the right paths and the wrong ids
 * would fail here for a reason that looks nothing like the cause.
 */
async function openEditor(saved: SavedCommand | undefined) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: 'dashboard',
    component: () => <Outlet />,
  })
  const editorRoute = createRoute({
    getParentRoute: () => dashboardRoute,
    path: '/c',
    component: () => <Outlet />,
  })
  const commandRoute = createRoute({
    getParentRoute: () => editorRoute,
    path: '$commandId',
    validateSearch: (search: Record<string, unknown>): { saved?: string } => ({
      saved: typeof search.saved === 'string' ? search.saved : undefined,
    }),
    loader: () => ({ definition: GIVE, catalogue, registries }),
    component: CommandEditor,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashboardRoute.addChildren([editorRoute.addChildren([commandRoute])]),
    ]),
    history: createMemoryHistory({
      initialEntries: [saved ? `/c/vanilla:give?saved=${saved.id}` : '/c/vanilla:give'],
    }),
  })

  const result = render(<RouterProvider router={router as never} />)
  await act(() => router.load())
  return result
}

beforeEach(() => {
  useCommandStore.getState().reset()
  useSavedCommandsStore.setState({ commands: [], status: 'ready', error: null })
  // No backend. `markOpened` fires on every open here and would otherwise write to
  // whatever the previous test file configured — this is an editor test, not a
  // storage one.
  configureStorage(null)
})

test('a saved command whose shape still matches is resumed', async () => {
  // The positive control. Without it the refusal test below would pass just as well
  // against an editor that never restored anything.
  const saved = savedCommand({ fingerprint: fingerprintOf(GIVE) })
  useSavedCommandsStore.setState({ commands: [saved] })

  await openEditor(saved)

  expect(useCommandStore.getState().value.args['/2']).toEqual({ id: 'stone', components: {} })
  expect(screen.getByText('/give @p minecraft:stone')).toBeTruthy()
})

test('a stale fingerprint refuses to resume rather than restoring part of the tree', async () => {
  const saved = savedCommand({ fingerprint: 'fp-from-an-older-build' })
  useSavedCommandsStore.setState({ commands: [saved] })

  await openEditor(saved)

  // The assertion persistence.md actually asks for: not "it warned", but that *no
  // value* from the tree arrived. A restore that half-worked would still show a
  // banner, and would be the exact failure the banner claims did not happen.
  expect(useCommandStore.getState().value).toEqual(EMPTY_VALUE)
  expect(screen.getByText(/older shape of this command/)).toBeTruthy()
})

test('a refusal clears what was already in the editor, rather than leaving it standing', async () => {
  // The negative control for the `else reset()` branch, which the test above cannot
  // provide: it starts from an empty store, so "nothing was restored" and "nothing was
  // there" look identical. Here something *is* there — the tree from whatever was open
  // a moment ago — and leaving it would render as the stale save having partly
  // restored, which is the one outcome persistence.md rules out.
  useCommandStore.getState().load(STALE_TREE)
  const saved = savedCommand({ id: 'saved-2', fingerprint: 'fp-from-an-older-build' })
  useSavedCommandsStore.setState({ commands: [saved] })

  await openEditor(saved)

  expect(useCommandStore.getState().value).toEqual(EMPTY_VALUE)
})

test('a record saved before fingerprints existed is refused, and says why', async () => {
  const saved = savedCommand({})

  useSavedCommandsStore.setState({ commands: [saved] })

  await openEditor(saved)

  expect(useCommandStore.getState().value).toEqual(EMPTY_VALUE)
  expect(screen.getByText(/before Kommands recorded command shapes/)).toBeTruthy()
})

test('the refused command still shows the text it produced', async () => {
  // The degradation, not just the refusal. What makes this state usable rather than
  // merely honest is that the command is still readable and still copyable.
  const saved = savedCommand({ fingerprint: 'fp-from-an-older-build' })
  useSavedCommandsStore.setState({ commands: [saved] })

  const { container } = await openEditor(saved)

  const shown = [...container.querySelectorAll('code')].map((node) => node.textContent)
  expect(shown).toContain('/give @p minecraft:stone')
})

test('opening with no saved id leaves the editor empty and unbannered', async () => {
  await openEditor(undefined)

  expect(useCommandStore.getState().value).toEqual(EMPTY_VALUE)
  expect(screen.queryByText(/older shape of this command/)).toBeNull()
})
