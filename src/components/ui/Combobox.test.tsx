import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { Combobox } from './Combobox'

const ITEMS = ['stone', 'netherite_sword', 'diamond_sword', 'torch'].map((id) => ({
  value: `minecraft:${id}`,
  label: `minecraft:${id}`,
}))

function Harness({
  limit,
  onChange = () => {},
}: {
  limit?: number
  onChange?: (v: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <Combobox
      aria-label="Item"
      value={value}
      options={ITEMS}
      limit={limit}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

const input = () => screen.getByRole('combobox', { name: 'Item' })

describe('Combobox', () => {
  test('every keystroke reaches onChange, suggestions or not', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.type(input(), 'custom:thing')
    expect(onChange).toHaveBeenLastCalledWith('custom:thing')
    expect(screen.getByText('Nothing matches. What you typed is used as it is.')).toBeDefined()
  })

  test('typing narrows the list, and the arrows and Enter pick from it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.type(input(), 'sword')
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option')).toHaveLength(2)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('minecraft:diamond_sword')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('does not open on focus alone', () => {
    render(<Harness />)
    input().focus()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('a long list is capped, and the footer says by how much', async () => {
    const user = userEvent.setup()
    render(<Harness limit={2} />)
    await user.click(screen.getByRole('button', { name: 'Item: show suggestions' }))
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2)
    expect(screen.getByText('Showing 2 of 4. Keep typing to narrow it.')).toBeDefined()
  })

  test('Escape closes the list and nothing above it', async () => {
    const outer = vi.fn()
    const user = userEvent.setup()
    render(
      <div onKeyDown={(event) => event.key === 'Escape' && outer()}>
        <Harness />
      </div>,
    )
    await user.type(input(), 's')
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
  })
})
