import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { TextComponentFields } from './TextComponentEditor'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { makeRegistryLookup } from '../../data/versions/registry'
import type { SerializeContext } from '../../data/versions/types'
import {
  emptyTextComponent,
  isEmptyTextComponent,
  serializeTextComponent,
  type TextComponent,
} from '../../schema/text-component'

/**
 * The recursive editor, driven the way a user drives it.
 *
 * Asserted through the serialized output rather than against the value tree: the
 * output is the product, and a test that checked the object would keep passing if the
 * editor built a shape the serializer then dropped.
 */

const ctx: SerializeContext = {
  traits: v1_21_1.traits,
  registries: makeRegistryLookup({ item: ['stone'], entity_type: ['pig'] }),
}

/**
 * A harness with real state, since the editor is controlled.
 *
 * It applies the same emptiness guard the argument type does, because that is the
 * boundary a user actually meets — `serializeTextComponent` on its own will happily
 * write a half-filled component, and the registry entry is what decides not to.
 */
function Harness({ onOutput }: { onOutput: (text: string) => void }) {
  const [value, setValue] = useState<TextComponent>(emptyTextComponent)
  onOutput(isEmptyTextComponent(value) ? '' : serializeTextComponent(value, ctx))
  return (
    <TextComponentFields
      value={value}
      ctx={ctx}
      ariaPrefix="Message"
      onChange={(next) => setValue(next)}
    />
  )
}

function renderEditor() {
  let output = ''
  render(<Harness onOutput={(text) => (output = text)} />)
  return { current: () => output }
}

test('typing text produces a component', async () => {
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'hi')
  await user.type(screen.getByLabelText('Message colour'), 'red')
  await user.click(screen.getByLabelText('Message bold'))

  expect(current()).toBe('{"text":"hi","color":"red","bold":true}')
})

test('switching content kind clears the previous kind rather than keeping both', async () => {
  // The property the union exists for. A component carrying both `text` and
  // `translate` is one the game resolves by picking one and ignoring the other.
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'hi')
  await user.selectOptions(screen.getByLabelText('Message kind'), 'translate')
  await user.type(screen.getByLabelText('Message translation key'), 'chat.type.text')

  expect(current()).toBe('{"translate":"chat.type.text"}')
  expect(screen.queryByLabelText('Message text')).toBeNull()
})

test('a score needs both halves before it is worth emitting', async () => {
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.selectOptions(screen.getByLabelText('Message kind'), 'score')
  await user.type(screen.getByLabelText('Message objective'), 'kills')
  // Half a score emits nothing at all rather than half a component.
  expect(current()).toBe('')

  await user.type(screen.getByLabelText('Message holder'), '@s')
  expect(current()).toBe('{"score":{"objective":"kills","name":"@s"}}')
})

test('a child is addressable by its own accessible name, and nests', async () => {
  // Recursion is why the aria prefix composes: without it every level has the same
  // five checkbox labels and nothing can say which one it reached.
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'one')
  await user.click(screen.getByLabelText('Add Message child'))
  await user.type(screen.getByLabelText('Message child 1 text'), 'two')
  await user.click(screen.getByLabelText('Message child 1 italic'))

  await user.click(screen.getByLabelText('Add Message child 1 child'))
  await user.type(screen.getByLabelText('Message child 1 child 1 text'), 'three')

  expect(current()).toBe(
    '{"text":"one","extra":[{"text":"two","italic":true,"extra":[{"text":"three"}]}]}',
  )
})

test('removing the last child takes the key with it', async () => {
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'one')
  await user.click(screen.getByLabelText('Add Message child'))
  await user.type(screen.getByLabelText('Message child 1 text'), 'two')
  expect(current()).toContain('extra')

  await user.click(screen.getByLabelText('Remove Message child 1'))
  expect(current()).toBe('{"text":"one"}')
})

test('a click event writes this version’s wrapper and payload key', async () => {
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'Click')
  await user.click(screen.getByLabelText('Add Message click event'))
  await user.selectOptions(screen.getByLabelText('Message click action'), 'run_command')
  await user.type(screen.getByLabelText('Message click value'), '/say hi')

  expect(current()).toBe('{"text":"Click","clickEvent":{"action":"run_command","value":"/say hi"}}')
})

test('a hover event picks its item from the version registry', async () => {
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'Item')
  await user.click(screen.getByLabelText('Add Message hover event'))
  await user.selectOptions(screen.getByLabelText('Message hover action'), 'show_item')
  await user.type(screen.getByLabelText('Message hover item'), 'stone')

  expect(current()).toBe(
    '{"text":"Item","hoverEvent":{"action":"show_item","contents":{"id":"minecraft:stone"}}}',
  )
})

test('a show_text hover is a whole component again', async () => {
  const user = userEvent.setup()
  const { current } = renderEditor()

  await user.type(screen.getByLabelText('Message text'), 'Hover')
  await user.click(screen.getByLabelText('Add Message hover event'))
  await user.type(screen.getByLabelText('Message hover text text'), 'Tip')

  expect(current()).toBe(
    '{"text":"Hover","hoverEvent":{"action":"show_text","contents":{"text":"Tip"}}}',
  )
})
