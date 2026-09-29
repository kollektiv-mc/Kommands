import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { Stepper } from './Stepper'

function Harness({ start, onChange }: { start: number | ''; onChange: (v: number | '') => void }) {
  const [value, setValue] = useState(start)
  return (
    <Stepper
      aria-label="Level"
      value={value}
      min={1}
      max={3}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

test('steps from the minimum when empty, and stops at the bounds', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness start="" onChange={onChange} />)
  const up = screen.getByRole('button', { name: 'Level: step up' })
  await user.click(up)
  expect(onChange).toHaveBeenLastCalledWith(1)
  await user.click(up)
  await user.click(up)
  expect(onChange).toHaveBeenLastCalledWith(3)
  expect((up as HTMLButtonElement).disabled).toBe(true)
})

test('the buttons stay out of the tab order, the field does not', () => {
  render(<Harness start={2} onChange={() => {}} />)
  expect(screen.getByRole('button', { name: 'Level: step down' }).tabIndex).toBe(-1)
  expect(screen.getByRole('spinbutton', { name: 'Level' }).tabIndex).toBe(0)
})

test('clearing the field gives back the empty value', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness start={2} onChange={onChange} />)
  await user.clear(screen.getByRole('spinbutton', { name: 'Level' }))
  expect(onChange).toHaveBeenLastCalledWith('')
})
