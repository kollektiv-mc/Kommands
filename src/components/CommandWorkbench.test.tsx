import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { CommandWorkbench } from './CommandWorkbench'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { makeRegistryLookup } from '../data/versions/registry'
import { withUi } from '../data/authored/ui'
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

test('authored presentation replaces the Brigadier argument names', () => {
  // Derivation cannot produce these: Brigadier names an argument for the parser that
  // reads it, and carries no help text at all. Without withUi the raw names show,
  // which is the fallback the other tests in this file rely on.
  render(<CommandWorkbench definition={withUi(GIVE)} version={v1_21_1} registries={registries} />)

  expect(screen.getByText('Recipients')).toBeDefined()
  expect(screen.getByText('Who receives the item.')).toBeDefined()
  expect(screen.queryByText('targets')).toBeNull()
})

test('the generated command can be copied', async () => {
  const user = userEvent.setup()
  renderGive()

  await user.type(screen.getByLabelText('Item'), 'stone')
  await user.click(screen.getByText('copy'))

  expect(await navigator.clipboard.readText()).toBe('/give @p minecraft:stone')
  expect(screen.getByText('copied')).toBeDefined()
})

test('switching to another command does not carry the previous values over', async () => {
  // Values are keyed by path, and a path means nothing outside the definition it was
  // built against — /2 is an item here and a block position in the next command. The
  // guard is read during render, so there is no frame showing the old values under
  // the new labels.
  const user = userEvent.setup()
  const { rerender } = renderGive()

  await user.type(screen.getByLabelText('Item'), 'stone')
  expect(screen.getByText('/give @p minecraft:stone')).toBeDefined()

  const CLEAR = commands['vanilla:clear']!
  rerender(<CommandWorkbench definition={CLEAR} version={v1_21_1} registries={registries} />)

  expect(screen.queryByText(/minecraft:stone/)).toBeNull()
})

test('building a message in the editors produces the canonical /tellraw command', async () => {
  // The /tellraw counterpart to the item test above, and the other half of #8: the
  // expected string is the canonical fixture in docs/minecraft-versions.md, reached by
  // driving the real recursive editor rather than by handing the serializer a value.
  const user = userEvent.setup()
  const TELLRAW = commands['vanilla:tellraw']!
  render(<CommandWorkbench definition={TELLRAW} version={v1_21_1} registries={registries} />)

  const targets = screen.getByLabelText('targets')
  await user.clear(targets)
  await user.type(targets, '@a')

  await user.type(screen.getByLabelText('Message text'), 'Server restarting')
  await user.type(screen.getByLabelText('Message colour'), 'red')
  await user.click(screen.getByLabelText('Message bold'))

  expect(
    screen.getByText('/tellraw @a {"text":"Server restarting","color":"red","bold":true}'),
  ).toBeDefined()
})

test('a command with nothing filled in says which argument is missing', async () => {
  // Rather than `/tellraw @p`, which reads as a finished command and sends nothing.
  render(
    <CommandWorkbench
      definition={commands['vanilla:tellraw']!}
      version={v1_21_1}
      registries={registries}
    />,
  )
  expect(screen.getByText('/tellraw @p <message>')).toBeDefined()
})

test('driving /execute through the app, where the Ref was never wired', async () => {
  // The regression this file exists to catch. Every serializer test passed a `resolve`
  // callback of its own, and the workbench passed none — so `/execute` emitted a
  // dangling `/execute  run` in the app while its unit tests were green. Rendering
  // through the workbench is the only place that gap is visible.
  const user = userEvent.setup()
  const { container } = render(
    <CommandWorkbench
      definition={withUi(commands['vanilla:execute']!)}
      version={v1_21_1}
      registries={registries}
      catalogue={commands}
    />,
  )
  const output = () => container.querySelector('code')?.textContent

  // Untouched: no dangling keyword, and no doubled space where the empty repeat sits.
  expect(output()).toBe('/execute')

  await user.click(screen.getByText('+ add'))
  await user.selectOptions(screen.getAllByLabelText('Clause')[0]!, '2')
  expect(output()).toBe('/execute as @p')

  // The run clause is optional, so it appears only once chosen — and choosing it
  // without choosing a command leaves a visible gap rather than a finished-looking
  // command that does nothing.
  await user.selectOptions(screen.getAllByLabelText('Clause').at(-1)!, '0')
  expect(output()).toBe('/execute as @p run <command>')

  await user.selectOptions(screen.getByLabelText('command'), 'vanilla:particle')
  // /particle's optional tail contributes nothing, and its optional `viewers` seeds
  // nothing: the two tokens that made the canonical fixture unproducible.
  expect(output()).toBe('/execute as @p run particle <name>')
})

test('reordering clauses reorders the command, and removing one takes its values', async () => {
  // `/execute as @a at @s` and `/execute at @s as @a` are different commands — the
  // clauses apply in order — so reorder is not a convenience. And a removed clause
  // must take its values with it: they used to stay behind under an index no longer
  // rendered and reappear, filled in, in the next clause added.
  const user = userEvent.setup()
  const { container } = render(
    <CommandWorkbench
      definition={commands['vanilla:execute']!}
      version={v1_21_1}
      registries={registries}
      catalogue={commands}
    />,
  )
  const output = () => container.querySelector('code')?.textContent

  await user.click(screen.getByText('+ add'))
  await user.selectOptions(screen.getAllByLabelText('Clause')[0]!, '2')
  await user.click(screen.getByText('+ add'))
  await user.selectOptions(screen.getAllByLabelText('Clause')[1]!, '3')
  expect(output()).toBe('/execute as @p at @p')

  // Make the two clauses tell each other apart before moving them.
  const second = screen.getAllByLabelText('targets')[1]!
  await user.clear(second)
  await user.type(second, '@s')
  expect(output()).toBe('/execute as @p at @s')

  await user.click(screen.getByLabelText('Move clause 2 earlier'))
  expect(output()).toBe('/execute at @s as @p')

  await user.click(screen.getByLabelText('Remove clause 1'))
  expect(output()).toBe('/execute as @p')
})
