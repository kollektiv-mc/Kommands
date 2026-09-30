import { describe, expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { NO_REGISTRIES } from '../../data/versions/registry'
import type { ArgumentOptions } from '../../schema/types'
import { ToggleEditor } from './ToggleEditor'

const ctx = { traits: v1_21_1.traits, registries: NO_REGISTRIES }

function setup(value: boolean | '', options: ArgumentOptions) {
  const onChange = vi.fn()
  const { getByRole } = render(
    <ToggleEditor value={value} onChange={onChange} options={options} diagnostics={[]} ctx={ctx} />,
  )
  return { box: getByRole('checkbox') as HTMLInputElement, onChange }
}

describe('ToggleEditor', () => {
  test('an optional bool left out shows false when the game assumes nothing else', () => {
    expect(setup('', { optional: true }).box.checked).toBe(false)
  })

  test('an optional bool left out shows the default the game assumes', () => {
    expect(setup('', { optional: true, default: true }).box.checked).toBe(true)
  })

  test('moving an optional bool off its default stores the value', async () => {
    const { box, onChange } = setup('', { optional: true, default: true })
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  test('moving it back to the default stores "not given", not the default spelled out', async () => {
    const { box, onChange } = setup(true, { optional: true })
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith('')
  })

  test('a required bool is always true or false', async () => {
    const { box, onChange } = setup(true, {})
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
