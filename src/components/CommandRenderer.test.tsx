import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { expect, test, describe, vi } from 'vitest'
import { CommandRenderer } from './CommandRenderer'
import commandsPayload from '../data/generated/1.21.1/commands.json'
import { EXECUTE } from '../schema/fixtures'
import { generate as GENERATE } from '../data/authored/commands/worldedit/generate'
import { EMPTY_VALUE } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'
import { NO_REGISTRIES } from '../data/versions/registry'
import type { SerializeContext } from '../data/versions/types'
import type { CommandDefinition } from '../schema/types'

const commands = commandsPayload.commands as unknown as Record<string, CommandDefinition>
const GIVE = commands['vanilla:give']!

const ctx: SerializeContext = {
  traits: v1_21_1.traits,
  registries: NO_REGISTRIES,
}

const actions = {
  setArg: vi.fn(),
  setFlag: vi.fn(),
  setChoice: vi.fn(),
  addInstance: vi.fn(),
  reorderRepeat: vi.fn(),
  setRef: vi.fn(),
}

const renderDef = (
  definition: Parameters<typeof CommandRenderer>[0]['definition'],
  value = EMPTY_VALUE,
) =>
  render(
    <CommandRenderer
      definition={definition}
      value={value}
      ctx={ctx}
      actions={actions}
      catalogue={commands}
    />,
  )

describe('the renderer walks a definition and nothing else', () => {
  test('renders /give from data alone', () => {
    renderDef(GIVE)
    // The keyword is the output's, not the form's: printed between fields it read as a
    // stray label and pushed the fields after it along.
    expect(screen.queryByText('give')).toBeNull()
    for (const name of ['targets', 'item', 'count']) {
      expect(screen.getByText(name, { exact: false })).toBeDefined()
    }
  })

  test('marks an optional argument as optional', () => {
    renderDef(GIVE)
    // getAllByText: the marker span and its enclosing label both match the string.
    expect(screen.getAllByText('optional').length).toBeGreaterThan(0)
  })

  test('renders /execute — repeat, choice and ref — with no special-casing', async () => {
    // The acceptance case. If this needed a branch on definition.id anywhere in
    // CommandRenderer, the schema would be the thing that is wrong.
    renderDef(EXECUTE)
    // findBy, because the clause chain is a lazy chunk and this is its first render.
    expect(await screen.findByLabelText('Add clause')).toBeDefined()
    // The run clause is optional and unselected, so the form offers it rather than
    // asserting it: "none" is the chosen segment, and there is no command picker yet.
    const tail = screen.getByRole('radiogroup', { name: 'Continue with' })
    expect(within(tail).getByRole<HTMLInputElement>('radio', { name: 'none' }).checked).toBe(true)
    expect(screen.queryByLabelText('Command')).toBeNull()
  })

  test('choosing the run clause reveals the command picker', () => {
    renderDef(EXECUTE, { ...EMPTY_VALUE, choices: { '/2': 0 } })
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'run' }).checked).toBe(true)
    expect(screen.getByLabelText('Command')).toBeDefined()
  })

  test('an embedded command renders inline, by the same walk', () => {
    // The Ref's whole point: /give's own editors appear inside /execute, and nothing
    // in this file learned that /give exists.
    renderDef(EXECUTE, {
      ...EMPTY_VALUE,
      choices: { '/2': 0 },
      refs: { '/2/|0/1': 'vanilla:give' },
    })
    expect(screen.getByLabelText('Command').textContent).toContain('/give')
    for (const name of ['targets', 'item', 'count']) {
      expect(screen.getAllByText(name, { exact: false }).length).toBeGreaterThan(0)
    }
  })

  test('renders //generate — a flagset and a variadic tail', () => {
    // The other half of the claim /execute made: a definition nobody derived, in
    // another dialect, drawn by the same walk. Nothing in this file knows WorldEdit
    // exists — it is the flagset node kind and the argument-type registry doing it.
    renderDef(GENERATE)
    expect(screen.queryByText('//generate')).toBeNull()
    for (const label of ['Hollow', 'Raw coordinate origin']) {
      expect(screen.getByText(label)).toBeDefined()
    }
    // Authored labels, from the definition's own ui metadata rather than the argument
    // names — the presentation half of the same data.
    expect(screen.getByText('Blocks')).toBeDefined()
    expect(screen.getByText('Expression')).toBeDefined()
  })

  test('the pattern editor offers a weight only once there is something to weigh', () => {
    // A weight on a single-entry pattern does not parse, so the column that would
    // invite one is not drawn until a second block exists.
    renderDef(GENERATE)
    expect(screen.queryByLabelText('Chance for block 1')).toBeNull()
  })
})

test('the renderer source contains no branch on a command id', () => {
  // A structural assertion, not a behavioural one. The rule it guards —
  // .claude/rules/command-definitions.md — is the load-bearing one for the whole
  // data-not-code design, and it is the kind of rule that erodes through one
  // reasonable-looking exception at a time.
  const source = readSource()
  expect(source).not.toMatch(/definition\.id\s*===/)
  expect(source).not.toMatch(/\bid\s*===\s*['"]vanilla:/)
})

function readSource(): string {
  // Read the file rather than importing it, so this asserts about the source rather
  // than about a bundle that may have inlined or renamed things. Resolved from the
  // repo root — under jsdom, import.meta.url is an http URL and readFileSync rejects
  // it ("The URL must be of scheme file").
  return readFileSync('src/components/CommandRenderer.tsx', 'utf8')
}
