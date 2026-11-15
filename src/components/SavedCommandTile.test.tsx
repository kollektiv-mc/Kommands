import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SavedCommand } from '../schema/saved'
import { SavedCommandTile } from './SavedCommandTile'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const saved = {
  id: 'kit',
  name: 'Easy mode',
  preview: '/difficulty easy',
  updatedAt: '2026-11-14T12:00:00.000Z',
} as unknown as SavedCommand

function tile() {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const onEdit = vi.fn()
  const drag = {
    dragging: false,
    target: false,
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
  }
  render(
    <SavedCommandTile
      saved={saved}
      note={null}
      linkable={false}
      onEdit={onEdit}
      onRemove={vi.fn()}
      onPin={vi.fn()}
      onLink={vi.fn()}
      drag={drag}
    />,
  )
  return { onEdit, writeText, target: screen.getByRole('button', { name: 'Copy Easy mode' }) }
}

test('a click copies the command and opens nothing', () => {
  const { onEdit, writeText, target } = tile()
  fireEvent.click(target, { detail: 1 })
  expect(writeText).toHaveBeenCalledWith('/difficulty easy')
  expect(onEdit).not.toHaveBeenCalled()
})

test('a double click opens the editor from the tile', () => {
  const { onEdit, writeText, target } = tile()
  fireEvent.click(target, { detail: 1 })
  fireEvent.click(target, { detail: 2 })
  fireEvent.doubleClick(target)
  expect(onEdit).toHaveBeenCalledWith(target.closest('li'))
  expect(writeText).toHaveBeenCalledTimes(1)
})
