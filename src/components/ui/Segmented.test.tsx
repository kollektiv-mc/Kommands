import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { Segmented } from './Segmented'

const OPTIONS = [
  { value: 'give', label: 'Give' },
  { value: 'clear', label: 'Clear' },
] as const

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState<string>('give')
  return (
    <Segmented
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

test('is a radio group whose choice follows a click and the arrow keys', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness onChange={onChange} />)
  expect(screen.getByRole('radiogroup', { name: 'Action' })).toBeDefined()
  expect((screen.getByRole('radio', { name: 'Give' }) as HTMLInputElement).checked).toBe(true)

  await user.click(screen.getByText('Clear'))
  expect(onChange).toHaveBeenLastCalledWith('clear')

  await user.keyboard('{ArrowLeft}')
  expect(onChange).toHaveBeenLastCalledWith('give')
})

test('tells the thumb where to sit', () => {
  const { container } = render(<Harness onChange={() => {}} />)
  const track = container.querySelector('.segmented') as HTMLElement
  expect(track.style.getPropertyValue('--seg-count')).toBe('2')
  expect(track.style.getPropertyValue('--seg-index')).toBe('0')
})
