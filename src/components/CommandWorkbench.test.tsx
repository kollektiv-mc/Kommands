import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { CommandWorkbench } from './CommandWorkbench'
import { GIVE } from '../schema/fixtures'
import { v1_21_1 } from '../data/versions/1.21.1'
import { useCommandStore } from '../stores/useCommandStore'

beforeEach(() => useCommandStore.getState().reset())

test('typing into the editors produces the command', async () => {
  // The whole PR end to end in one test: definition -> renderer -> value tree ->
  // serializer -> output, with nothing command-specific anywhere in between.
  const user = userEvent.setup()
  render(<CommandWorkbench definition={GIVE} version={v1_21_1} />)

  // Three different roles, one per editor, which is the accessible shape falling out
  // of the argument types: entity_selector offers a datalist so it is a combobox,
  // raw_text is a plain textbox, integer is a spinbutton.
  const targets = screen.getByRole('combobox')
  await user.clear(targets)
  await user.type(targets, '@p')
  await user.type(screen.getByRole('textbox'), 'minecraft:netherite_sword')
  await user.type(screen.getByRole('spinbutton'), '1')

  expect(screen.getByText('/give @p minecraft:netherite_sword 1')).toBeDefined()
})

test('an unfilled optional tail is simply absent from the output', async () => {
  const user = userEvent.setup()
  render(<CommandWorkbench definition={GIVE} version={v1_21_1} />)

  await user.type(screen.getByRole('textbox'), 'minecraft:stone')

  // entity_selector defaults to the first legal shorthand rather than empty, so the
  // command is valid from the first keystroke instead of after three.
  expect(screen.getByText('/give @p minecraft:stone')).toBeDefined()
})

test('the output panel names the version it is generating for', () => {
  render(<CommandWorkbench definition={GIVE} version={v1_21_1} />)
  expect(screen.getByText(`Output · ${v1_21_1.id}`)).toBeDefined()
})
