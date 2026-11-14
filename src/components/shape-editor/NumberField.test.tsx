import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { RUNG_HEIGHT } from './ladder'
import { NumberField } from './NumberField'

function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.assign(event, { pointerId: 1 })
  act(() => {
    window.dispatchEvent(event)
  })
}

// A test that fails mid-drag leaves no ladder listening to the next.
afterEach(() => pointer('pointercancel', 0, 0))

function setUp(value = 1) {
  const onChange = vi.fn()
  const onDone = vi.fn()
  render(<NumberField label="Width" value={value} step={0.1} onChange={onChange} onDone={onDone} />)
  const input = screen.getByRole('textbox', { name: 'Width' })
  fireEvent.pointerDown(input, { button: 1, clientX: 50, clientY: 50, pointerId: 1 })
  return { onChange, onDone }
}

describe('a number field middle drag', () => {
  test('shows the ladder and changes the value', () => {
    const { onChange, onDone } = setUp()
    expect(screen.getByText('0.001')).toBeTruthy()
    pointer('pointermove', 74, 50)
    expect(onChange).toHaveBeenLastCalledWith(1.2)
    pointer('pointermove', 74, 50 - RUNG_HEIGHT)
    pointer('pointermove', 86, 50 - RUNG_HEIGHT)
    expect(onChange).toHaveBeenLastCalledWith(2.2)
    pointer('pointerup', 86, 50)
    expect(onDone).toHaveBeenCalledOnce()
    expect(screen.queryByText('0.001')).toBeNull()
  })

  test('Escape puts the value back', () => {
    const { onChange, onDone } = setUp(3)
    pointer('pointermove', 98, 50)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onChange).toHaveBeenLastCalledWith(3)
    expect(onDone).toHaveBeenCalledOnce()
    expect(screen.queryByText('0.001')).toBeNull()
  })
})
