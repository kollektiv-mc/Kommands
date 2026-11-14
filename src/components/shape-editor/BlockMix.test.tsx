import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { BlocksField } from './BlockMix'

const store = () => useShapeEditorStore.getState()

beforeEach(() => {
  store().load({ layers: [], pattern: 'stone', hollow: false, round: false })
})

describe('the block mix', () => {
  test('adds a block, shares the chances, and edits them', async () => {
    const user = userEvent.setup()
    render(<BlocksField />)
    await user.click(screen.getByRole('button', { name: 'Block mix' }))
    await user.click(screen.getByRole('button', { name: 'Add block' }))
    await user.keyboard('dirt')
    expect(store().pattern).toBe('50%stone,50%dirt')
    const chance = screen.getAllByRole('textbox', { name: 'Chance' })[1]!
    await user.clear(chance)
    await user.type(chance, '2x5')
    expect(store().pattern).toBe('50%stone,25%dirt')
    await user.click(screen.getByRole('button', { name: 'Remove stone' }))
    expect(store().pattern).toBe('dirt')
    expect(screen.getByRole('button', { name: 'Remove dirt' })).toHaveProperty('disabled', true)
  })

  test('Escape closes it as one undo step', async () => {
    const user = userEvent.setup()
    render(<BlocksField />)
    await user.click(screen.getByRole('button', { name: 'Block mix' }))
    await user.click(screen.getByRole('button', { name: 'Add block' }))
    await user.keyboard('dirt{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Block mix' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Block mix' }))
    store().undo()
    expect(store().pattern).toBe('stone')
  })

  test('a press outside closes it', async () => {
    const user = userEvent.setup()
    render(<BlocksField />)
    await user.click(screen.getByRole('button', { name: 'Block mix' }))
    await user.click(document.body)
    expect(screen.queryByRole('dialog', { name: 'Block mix' })).toBeNull()
  })
})
