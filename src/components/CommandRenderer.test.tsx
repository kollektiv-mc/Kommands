import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { expect, test, describe, vi } from 'vitest'
import { CommandRenderer } from './CommandRenderer'
import { EXECUTE, GENERATE, GIVE } from '../schema/fixtures'
import { EMPTY_VALUE } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'
import type { SerializeContext } from '../data/versions/types'

const ctx: SerializeContext = {
  traits: v1_21_1.traits,
  registries: { entries: () => [], has: () => true },
}

const actions = {
  setArg: vi.fn(),
  setFlag: vi.fn(),
  setChoice: vi.fn(),
  setRepeat: vi.fn(),
}

const renderDef = (definition: Parameters<typeof CommandRenderer>[0]['definition']) =>
  render(
    <CommandRenderer definition={definition} value={EMPTY_VALUE} ctx={ctx} actions={actions} />,
  )

describe('the renderer walks a definition and nothing else', () => {
  test('renders /give from data alone', () => {
    renderDef(GIVE)
    expect(screen.getByText('give')).toBeDefined()
    for (const name of ['targets', 'item', 'count']) {
      expect(screen.getByText(name, { exact: false })).toBeDefined()
    }
  })

  test('marks an optional argument as optional', () => {
    renderDef(GIVE)
    // getAllByText: the marker span and its enclosing label both match the string.
    expect(screen.getAllByText('optional').length).toBeGreaterThan(0)
  })

  test('renders /execute — repeat, choice and ref — with no special-casing', () => {
    // The acceptance case. If this needed a branch on definition.id anywhere in
    // CommandRenderer, the schema would be the thing that is wrong.
    renderDef(EXECUTE)
    expect(screen.getByText('execute')).toBeDefined()
    expect(screen.getByText('run')).toBeDefined()
    expect(screen.getByText('+ add')).toBeDefined()
    expect(screen.getByText('embedded command')).toBeDefined()
  })

  test('renders //generate — a flagset and a variadic tail', () => {
    renderDef(GENERATE)
    expect(screen.getByText('//generate')).toBeDefined()
    for (const label of ['Hollow', 'Raw coordinate origin']) {
      expect(screen.getByText(label)).toBeDefined()
    }
    // we_pattern and we_expression have no editors; both degrade to a text field
    // rather than blanking the command.
    expect(screen.getByText('pattern', { exact: false })).toBeDefined()
    expect(screen.getByText('expression', { exact: false })).toBeDefined()
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
