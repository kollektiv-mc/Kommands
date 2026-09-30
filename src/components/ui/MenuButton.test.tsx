import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { MenuButton } from './MenuButton'

test('opens a list of actions, runs the one chosen, and hands focus back', async () => {
  const add = vi.fn()
  const user = userEvent.setup()
  render(
    <MenuButton
      label="Add component"
      items={[
        { key: 'a', label: 'Enchantments', onSelect: add },
        { key: 'b', label: 'Custom name', onSelect: () => {}, disabled: true },
      ]}
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Add component' })
  await user.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('true')

  await user.keyboard('{ArrowDown}')
  expect(document.activeElement?.textContent).toBe('Enchantments')
  await user.keyboard('{Enter}')
  expect(add).toHaveBeenCalledOnce()
  expect(document.activeElement).toBe(trigger)
  expect(screen.queryByText('Custom name')).toBeNull()
})

test('Escape closes it and returns focus to the button', async () => {
  const user = userEvent.setup()
  render(<MenuButton label="More" items={[{ key: 'a', label: 'Pin', onSelect: () => {} }]} />)
  const trigger = screen.getByRole('button', { name: 'More' })
  await user.click(trigger)
  await user.keyboard('{Escape}')
  expect(screen.queryByText('Pin')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
