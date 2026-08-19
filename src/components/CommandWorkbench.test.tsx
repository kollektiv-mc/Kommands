import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { CommandWorkbench } from './CommandWorkbench'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { makeRegistryLookup } from '../data/versions/registry'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { CommandDefinition } from '../schema/types'
import { useCommandStore } from '../stores/useCommandStore'

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
const GIVE = commands['vanilla:give']!

const registries = makeRegistryLookup({
  item: ['netherite_sword', 'stone'],
  enchantment: ['sharpness'],
})

const renderGive = () =>
  render(<CommandWorkbench definition={GIVE} version={v1_21_1} registries={registries} />)

beforeEach(() => useCommandStore.getState().reset())

test('building an item in the editors produces the canonical command', async () => {
  // The whole thing end to end: derived definition -> renderer -> value tree ->
  // serializer -> output, with nothing command-specific anywhere in between. The
  // expected string is the first canonical fixture in docs/minecraft-versions.md, so
  // this is the test that the editors actually drive the serializer the fixtures pin.
  const user = userEvent.setup()
  renderGive()

  await user.type(screen.getByLabelText('Item'), 'netherite_sword')

  await user.selectOptions(screen.getByLabelText('Add component'), 'enchantments')
  await user.click(screen.getByText('+ add'))
  await user.click(screen.getByText('+ enchantment'))
  await user.type(screen.getByLabelText('Enchantment'), 'sharpness')

  const level = screen.getByLabelText('Level')
  await user.clear(level)
  await user.type(level, '5')

  await user.type(screen.getByLabelText(/^count/), '1')

  expect(
    screen.getByText('/give @p minecraft:netherite_sword[enchantments={levels:{sharpness:5}}] 1'),
  ).toBeDefined()
})

test('an unfilled optional tail is simply absent from the output', async () => {
  const user = userEvent.setup()
  renderGive()

  await user.type(screen.getByLabelText('Item'), 'stone')

  // entity_selector defaults to the first legal shorthand rather than empty, so the
  // command is valid from the first keystroke instead of after three.
  expect(screen.getByText('/give @p minecraft:stone')).toBeDefined()
})

test('an item that does not exist in this version warns without blocking the output', async () => {
  // Validation warns, never blocks. A generator that refused to generate would be
  // failing at the one thing it exists to do.
  const user = userEvent.setup()
  renderGive()

  await user.type(screen.getByLabelText('Item'), 'copper_sword')

  expect(screen.getByText('copper_sword is not an item in this version.')).toBeDefined()
  expect(screen.getByText('/give @p minecraft:copper_sword')).toBeDefined()
})

test('the output panel names the version it is generating for', () => {
  renderGive()
  expect(screen.getByText(`Output · ${v1_21_1.id}`)).toBeDefined()
})
