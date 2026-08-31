import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { CommandNav } from './CommandNav'
import { renderWithRouter } from '../test-router'
import type { Catalogue } from './CommandRenderer'
import type { CommandDefinition } from '../schema/types'

function definition(
  id: string,
  label: string,
  dialect: CommandDefinition['dialect'],
  aliases?: string[],
): CommandDefinition {
  return {
    id,
    label,
    dialect,
    provenance: 'authored',
    versions: { min: '1.21.1' },
    ...(aliases ? { aliases } : {}),
    root: { kind: 'sequence', nodes: [{ kind: 'literal', token: label.replace(/^\/+/, '') }] },
  }
}

const CATALOGUE: Catalogue = {
  'vanilla:give': definition('vanilla:give', '/give', 'vanilla'),
  'vanilla:teleport': definition('vanilla:teleport', '/teleport', 'vanilla', ['tp']),
  'worldedit:generate': definition('worldedit:generate', '//generate', 'worldedit', ['//gen']),
}

test('every command in the catalogue is a link, grouped by dialect', async () => {
  await renderWithRouter(<CommandNav catalogue={CATALOGUE} />)

  // Percent-encoded, because a command id carries a colon and that is what a URL does
  // with one. The router decodes it back into the `commandId` param, so the route sees
  // `vanilla:give` — this asserts the encoded half so a change to either is visible.
  expect(screen.getByRole('link', { name: '/give' }).getAttribute('href')).toBe('/c/vanilla%3Agive')
  // Grouped rather than mixed, because the distinction has teeth: `embeddableIn`
  // filters by it, since /execute hands its tail to the vanilla dispatcher and a
  // WorldEdit command offered there reads fine and cannot run.
  const worldedit = screen.getByRole('heading', { name: 'WorldEdit' }).closest('section')!
  expect(within(worldedit).getByRole('link', { name: '//generate' })).toBeDefined()
  expect(within(worldedit).queryByRole('link', { name: '/give' })).toBeNull()
})

test('the count comes from the catalogue, not from a hand-authored list', async () => {
  await renderWithRouter(<CommandNav catalogue={CATALOGUE} />)

  // The page this replaced advertised eight tiles while eighty definitions were
  // already routable. Reading the catalogue is what stops that drifting again.
  expect(screen.getByText('3 commands')).toBeDefined()
})

test('filtering matches aliases, not only labels', async () => {
  const user = userEvent.setup()
  await renderWithRouter(<CommandNav catalogue={CATALOGUE} />)

  await user.type(screen.getByRole('searchbox'), 'tp')

  // Someone looking for the teleport command types `tp`. A filter reading labels alone
  // would tell them it does not exist.
  expect(screen.getByRole('link', { name: '/teleport' })).toBeDefined()
  expect(screen.queryByRole('link', { name: '/give' })).toBeNull()
})

test('a filter matching nothing says so rather than showing an empty list', async () => {
  const user = userEvent.setup()
  await renderWithRouter(<CommandNav catalogue={CATALOGUE} />)

  await user.type(screen.getByRole('searchbox'), 'zzz')
  expect(screen.getByText('nothing matches zzz')).toBeDefined()
})

test('the command on screen is marked as the current page', async () => {
  await renderWithRouter(<CommandNav catalogue={CATALOGUE} activeId="vanilla:give" />)

  // aria-current rather than colour alone: the accent says which row is active to
  // anyone who can see it, and this says the same thing to anyone who cannot.
  expect(screen.getByRole('link', { name: '/give' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('link', { name: '/teleport' }).getAttribute('aria-current')).toBeNull()
})
