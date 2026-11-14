import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { v1_21_1 } from '../../data/versions/1.21.1'
import { makeRegistryLookup } from '../../data/versions/registry'
import { EMPTY_MASK, NEW_RULE, type MaskValue } from '../../schema/argument-types/we-mask'
import { MaskEditor } from './MaskEditor'

const ctx = {
  traits: v1_21_1.traits,
  registries: makeRegistryLookup({ block: ['stone', 'dirt'], 'tag/block': ['logs'] }),
}

function setup(value: MaskValue) {
  const onChange = vi.fn()
  render(<MaskEditor value={value} onChange={onChange} options={{}} diagnostics={[]} ctx={ctx} />)
  return onChange
}

describe('MaskEditor', () => {
  test('a block typed into Include is added on Enter', async () => {
    const onChange = setup(EMPTY_MASK)
    await userEvent.type(screen.getByRole('combobox', { name: 'Add to Include' }), 'stone{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MASK, include: ['stone'] })
  })

  test('an included tag replaces the blocks, which cannot sit beside it', async () => {
    const onChange = setup({ ...EMPTY_MASK, include: ['stone', 'dirt'] })
    await userEvent.type(screen.getByRole('combobox', { name: 'Add to Include' }), '#logs{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MASK, include: ['#logs'] })
  })

  test('Exclude keeps blocks and tags side by side', async () => {
    const onChange = setup({ ...EMPTY_MASK, exclude: ['stone'] })
    await userEvent.type(screen.getByRole('combobox', { name: 'Add to Exclude' }), '#logs{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MASK, exclude: ['stone', '#logs'] })
  })

  test('a chip is removed by its own button', async () => {
    const onChange = setup({ ...EMPTY_MASK, include: ['stone', 'dirt'] })
    await userEvent.click(screen.getByRole('button', { name: 'Remove stone from Include' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MASK, include: ['dirt'] })
  })

  test('+ rule adds a rule', async () => {
    const onChange = setup(EMPTY_MASK)
    await userEvent.click(screen.getByRole('button', { name: '+ rule' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MASK, rules: [NEW_RULE] })
  })

  test('not on a rule negates that rule only', async () => {
    const onChange = setup({ ...EMPTY_MASK, rules: [NEW_RULE, NEW_RULE] })
    await userEvent.click(screen.getAllByRole('button', { name: 'not' })[1]!)
    expect(onChange).toHaveBeenLastCalledWith({
      ...EMPTY_MASK,
      rules: [NEW_RULE, { ...NEW_RULE, not: true }],
    })
  })

  test('a rule on a test that cannot move says This block', () => {
    setup({ ...EMPTY_MASK, rules: [{ ...NEW_RULE, test: 'chance' }] })
    expect(screen.queryByRole('combobox', { name: 'Rule 1: which block' })).toBeNull()
    expect(screen.getByText('This block')).toBeDefined()
  })
})
