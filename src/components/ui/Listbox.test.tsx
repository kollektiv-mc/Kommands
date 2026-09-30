import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { pick } from '../../test-controls'
import { Listbox } from './Listbox'

const OPTIONS = [
  { value: 'clear', label: 'clear' },
  { value: 'give', label: 'give', description: 'apply an effect' },
  { value: 'grant', label: 'grant' },
] as const

function Harness({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<string>('clear')
  return (
    <Listbox
      aria-label="Action"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

const trigger = () => screen.getByRole('combobox', { name: 'Action' })

describe('Listbox', () => {
  test('shows the chosen label and no options until opened', () => {
    render(<Harness />)
    expect(trigger().textContent).toContain('clear')
    expect(screen.queryByRole('option')).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  test('a click opens it, a click on an option chooses it and closes it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await pick(user, trigger(), 'give')
    expect(onChange).toHaveBeenCalledWith('give')
    expect(trigger().textContent).toContain('give')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('the keyboard opens, walks with wrapping, and picks without moving focus', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    const active = () => document.getElementById(trigger().getAttribute('aria-activedescendant')!)
    expect(active()?.textContent).toContain('clear')
    await user.keyboard('{ArrowUp}')
    expect(active()?.textContent).toContain('grant')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('grant')
    expect(document.activeElement).toBe(trigger())
  })

  test('typing jumps to the next option that starts with what was typed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    trigger().focus()
    await user.keyboard('g')
    expect(onChange).toHaveBeenLastCalledWith('give')
    await user.keyboard('g')
    expect(onChange).toHaveBeenLastCalledWith('grant')
  })

  test('Escape closes the list and nothing above it', () => {
    const outer = vi.fn()
    render(
      <div onKeyDown={outer}>
        <Harness />
      </div>,
    )
    fireEvent.click(trigger())
    fireEvent.keyDown(trigger(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
  })

  test('a press outside closes it', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>,
    )
    await user.click(trigger())
    await user.click(screen.getByText('elsewhere'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('choosing inside a wrapping label does not reopen the list', async () => {
    // The editors still sit inside the label ArgumentView wraps around an argument, and
    // a click inside a label activates it unless the click is cancelled.
    const user = userEvent.setup()
    render(
      <label>
        <span>Action</span>
        <Harness />
      </label>,
    )
    await pick(user, trigger(), 'give')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
