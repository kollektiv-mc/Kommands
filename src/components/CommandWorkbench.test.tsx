import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { CommandWorkbench } from './CommandWorkbench'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { makeRegistryLookup } from '../data/versions/registry'
import { withUi } from '../data/authored/ui'
import { generate } from '../data/authored/commands/worldedit/generate'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { CommandDefinition } from '../schema/types'
import { useCommandStore } from '../stores/useCommandStore'

/**
 * The 3D stage, stubbed.
 *
 * `//generate` binds a preview, so several tests below mount one. jsdom has no WebGL,
 * and the real stage would try to make a context and fail — for a reason that has
 * nothing to do with what these tests assert. Stubbing it keeps them about the
 * serializer, and leaves the stage's own behaviour to PreviewCanvas.test.tsx.
 */
vi.mock('./PreviewStage', () => ({
  default: () => <div data-testid="preview-stage" />,
}))

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

test('building //generate in the editors, in a dialect nothing here knows about', async () => {
  // The other end of the acceptance set. `//generate` has no derived skeleton, no
  // Brigadier parser behind either of its argument types, and a different dialect —
  // and it reaches the output panel through exactly the same workbench.
  const user = userEvent.setup()
  const { container } = render(
    <CommandWorkbench
      definition={generate}
      version={v1_21_1}
      registries={makeRegistryLookup({ block: ['stone', 'dirt'] })}
    />,
  )
  const output = () => container.querySelector('code')?.textContent

  // Both arguments are required, so an untouched command shows its gaps.
  expect(output()).toBe('//generate <pattern> <expression>')

  await user.click(screen.getByLabelText('Hollow'))
  await user.click(screen.getByLabelText('Raw coordinate origin'))
  // One combined token, not `-h -r`.
  expect(output()).toBe('//generate -hr <pattern> <expression>')

  await user.click(screen.getByText('+ block'))
  await user.type(screen.getByLabelText('Block 1'), 'stone')
  expect(output()).toBe('//generate -hr stone <expression>')

  await user.type(screen.getByLabelText('Expression'), 'x^2+y^2+z^2 < 1')
  expect(output()).toBe('//generate -hr stone x^2+y^2+z^2 < 1')

  // A second block turns the chance columns on, because now there is a mix.
  await user.click(screen.getByText('+ block'))
  await user.type(screen.getByLabelText('Block 2'), 'dirt')
  await user.type(screen.getByLabelText('Chance for block 1'), '50')
  await user.type(screen.getByLabelText('Chance for block 2'), '50')
  expect(output()).toBe('//generate -hr 50%stone,50%dirt x^2+y^2+z^2 < 1')
})

test('the origin-mode mutex warns and the command still generates', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <CommandWorkbench definition={generate} version={v1_21_1} registries={registries} />,
  )
  await user.click(screen.getByLabelText('Raw coordinate origin'))
  await user.click(screen.getByLabelText('Placement origin'))

  expect(screen.getByText(/Only one origin mode applies/)).toBeDefined()
  // Warns, never blocks. WorldEdit accepts all three and silently takes -r, so the
  // command is real and the warning says which one wins rather than refusing it.
  expect(container.querySelector('code')?.textContent).toBe('//generate -ro <pattern> <expression>')
})

test('the expression field says what is wrong with the formula, and generates anyway', async () => {
  // The acceptance case for the evaluator being wired to the field that ships. Before
  // it, this field balanced brackets and stopped: `2 +* 3` was accepted in silence.
  //
  // Each of these still reaches the output panel. Validation warns and never blocks,
  // and a half-typed formula is the normal state of a field someone is typing into.
  const user = userEvent.setup()
  const { container } = render(
    <CommandWorkbench
      definition={generate}
      version={v1_21_1}
      registries={makeRegistryLookup({ block: ['stone'] })}
    />,
  )
  const output = () => container.querySelector('code')?.textContent
  const field = screen.getByLabelText('Expression')

  await user.click(screen.getByText('+ block'))
  await user.type(screen.getByLabelText('Block 1'), 'stone')

  await user.type(field, 'sin(x')
  expect(screen.getByText(/Expected \) here/)).toBeDefined()
  expect(output()).toBe('//generate stone sin(x')

  await user.clear(field)
  await user.type(field, '2 +* 3')
  expect(screen.getByText(/cannot start a value/)).toBeDefined()
  expect(output()).toBe('//generate stone 2 +* 3')

  await user.clear(field)
  await user.type(field, 'frobnicate(x)')
  expect(screen.getByText('frobnicate is not a function.')).toBeDefined()
  expect(output()).toBe('//generate stone frobnicate(x)')

  // A formula this preview cannot draw is not a mistake in the formula. `perlin` is a
  // real WorldEdit function; the diagnostic says so rather than calling it a typo.
  await user.clear(field)
  await user.type(field, 'perlin(x,y,z,1,1,1) > 0')
  expect(screen.getByText(/perlin is not implemented yet/)).toBeDefined()

  // And a formula that is simply correct says nothing at all.
  await user.clear(field)
  await user.type(field, 'x^2+y^2+z^2 < 1')
  expect(screen.queryByText(/not a function|cannot start a value|Expected/)).toBeNull()
  expect(output()).toBe('//generate stone x^2+y^2+z^2 < 1')
})

test('re-pointing an embedded command clears what the last one held', async () => {
  // A crash, not a cosmetic problem: the embedded command's values are keyed below the
  // Ref's path, so /give's item_stack sat exactly where /particle reads a position, and
  // the serializer threw on a value of a shape its type never makes — taking the whole
  // output panel down rather than producing a wrong command.
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

  await user.selectOptions(screen.getAllByLabelText('Clause').at(-1)!, '0')
  await user.selectOptions(screen.getByLabelText('command'), 'vanilla:give')
  await user.type(screen.getByLabelText('Item'), 'stone')
  expect(output()).toBe('/execute run give @p minecraft:stone')

  await user.selectOptions(screen.getByLabelText('command'), 'vanilla:particle')
  expect(output()).toBe('/execute run particle <name>')
})

test('a command with a preview gets a panel, and one without does not', async () => {
  // The binding reaching the UI, which is the half `previewProblems` cannot check: it
  // proves the definition is sound, not that anything renders it.
  const { unmount } = render(
    <CommandWorkbench definition={generate} version={v1_21_1} registries={registries} />,
  )
  expect(await screen.findByTestId('preview-stage')).toBeDefined()
  expect(screen.getByText('Preview')).toBeDefined()
  unmount()

  renderGive()
  expect(screen.queryByText('Preview')).toBeNull()
})

test('the output panel is not downstream of the preview', async () => {
  // `.claude/rules/previews.md`: preview state must never gate command output. Asserted
  // rather than asserted-in-a-comment, because the arrangement that guarantees it — the
  // two panels being siblings — is one refactor away from not being true.
  const { container } = render(
    <CommandWorkbench definition={generate} version={v1_21_1} registries={registries} />,
  )
  const output = () => container.querySelector('code')?.textContent

  expect(output()).toBe('//generate <pattern> <expression>')
  await userEvent.type(screen.getByLabelText('Expression'), 'x < 0')
  expect(output()).toBe('//generate <pattern> x < 0')
})

/**
 * A Repeat holding an editor with internal state.
 *
 * Synthetic, and it has to be: `/execute`'s Repeat is the only one in the catalogue and
 * none of its 13 clause branches uses an editor that holds local state, so the bug #33
 * describes is unreachable with real data. That is what made it latent rather than
 * absent — every editor added from here is free to hold state, and nothing warned the
 * author that doing so inside a Repeat was unsafe.
 *
 * `max: 2` rides along because the same definition is the only way to reach that gate
 * too: no derived definition declares a `max`.
 */
const REPEATED_ITEM: CommandDefinition = {
  id: 'test:repeated-item',
  label: '/repeated',
  dialect: 'vanilla',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  root: {
    kind: 'sequence',
    nodes: [
      { kind: 'literal', token: 'repeated' },
      {
        kind: 'repeat',
        min: 0,
        max: 2,
        node: { kind: 'argument', name: 'item', type: 'item_stack' },
      },
    ],
  },
}

const renderRepeated = () =>
  render(<CommandWorkbench definition={REPEATED_ITEM} version={v1_21_1} registries={registries} />)

test('a reordered clause takes its component state with it, not just its values', async () => {
  // The reproduction from #33, as a test. Before instance identity existed, values moved
  // and internal state did not:
  //
  //   BEFORE  items    : stone, netherite_sword
  //   BEFORE  dropdowns: "",    enchantments
  //           ← move clause 2 earlier →
  //   AFTER   items    : netherite_sword, stone   ✅ store-held values moved
  //   AFTER   dropdowns: "",    enchantments      ❌ internal state stayed put
  //
  // The dropdown is `ItemStackEditor`'s "Add component" select, which holds its choice
  // in useState — exactly the shape the issue names.
  const user = userEvent.setup()
  renderRepeated()

  await user.click(screen.getByLabelText('Add clause'))
  await user.click(screen.getByLabelText('Add clause'))

  const items = () => screen.getAllByLabelText('Item')
  const dropdowns = () => screen.getAllByLabelText<HTMLSelectElement>('Add component')

  await user.type(items()[0]!, 'stone')
  await user.type(items()[1]!, 'netherite_sword')
  await user.selectOptions(dropdowns()[1]!, 'enchantments')

  expect(items().map((i) => (i as HTMLInputElement).value)).toEqual(['stone', 'netherite_sword'])
  expect(dropdowns().map((d) => d.value)).toEqual(['', 'enchantments'])

  await user.click(screen.getByLabelText('Move clause 2 earlier'))

  // Both halves move together, which is the whole of the fix.
  expect(items().map((i) => (i as HTMLInputElement).value)).toEqual(['netherite_sword', 'stone'])
  expect(dropdowns().map((d) => d.value)).toEqual(['enchantments', ''])
})

test('the DOM node moves with the clause, which is what carries focus and selection', async () => {
  // The same failure in its other form, asserted at its mechanism. Focus, the caret, an
  // IME composition and a text selection are all bound to a *DOM node*; with `key={i}`
  // React kept one node per position and repainted it, so all of them stayed at the slot
  // while the values moved past. Keying on the id makes React move the node instead.
  //
  // Asserted as node identity rather than via `document.activeElement`, because reorder
  // here is driven by clicking a button and the click itself takes focus — which would
  // test the button, not the clause.
  const user = userEvent.setup()
  renderRepeated()

  await user.click(screen.getByLabelText('Add clause'))
  await user.click(screen.getByLabelText('Add clause'))

  const items = () => screen.getAllByLabelText<HTMLInputElement>('Item')
  await user.type(items()[1]!, 'stone')
  const second = items()[1]!

  await user.click(screen.getByLabelText('Move clause 2 earlier'))

  expect(items()[0]).toBe(second)
  expect(items()[0]!.value).toBe('stone')
})

test('a removed clause does not leave its values for the next one', async () => {
  // What `reindexInstances` existed to prevent, still true now that it is gone: removal
  // clears the dropped instance's subtree, so the id is retired with its values.
  const user = userEvent.setup()
  renderRepeated()

  await user.click(screen.getByLabelText('Add clause'))
  await user.type(screen.getAllByLabelText('Item')[0]!, 'stone')
  await user.click(screen.getByLabelText('Remove clause 1'))
  await user.click(screen.getByLabelText('Add clause'))

  expect(screen.getAllByLabelText<HTMLInputElement>('Item')[0]!.value).toBe('')
})

test('a Repeat stops offering + add at its max', async () => {
  // RepeatNode.max was declared, documented, and read by nothing (part of #30), so a
  // Repeat declared max: 2 accepted a third.
  const user = userEvent.setup()
  renderRepeated()

  await user.click(screen.getByLabelText('Add clause'))
  expect(screen.queryByLabelText('Add clause')).not.toBeNull()

  await user.click(screen.getByLabelText('Add clause'))
  expect(screen.getAllByLabelText('Item')).toHaveLength(2)
  expect(screen.queryByLabelText('Add clause')).toBeNull()
})
