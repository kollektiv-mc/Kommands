import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { Landing } from './Landing'

test('shows the title and the one button, with the tools view closed', () => {
  render(<Landing />)

  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kommands')
  expect(screen.getByRole('button', { name: 'Browse tools' })).toBeDefined()
  // Not `queryByRole('dialog')`: a closed <dialog> is still in the document, it just
  // has no dialog role. Asserting on `open` is what actually distinguishes the states.
  expect(screen.getByRole('heading', { level: 2, hidden: true }).closest('dialog')?.open).toBe(
    false,
  )
})

test('browsing opens the tools view, and closing it returns', async () => {
  const user = userEvent.setup()
  render(<Landing />)

  await user.click(screen.getByRole('button', { name: 'Browse tools' }))
  expect(screen.getByRole('dialog')).toBeDefined()

  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('every tile is tagged unavailable and none of them is a control', async () => {
  const user = userEvent.setup()
  render(<Landing />)
  await user.click(screen.getByRole('button', { name: 'Browse tools' }))

  const tiles = within(screen.getByRole('dialog')).getAllByRole('listitem')
  expect(tiles.length).toBeGreaterThan(0)

  for (const tile of tiles) {
    expect(within(tile).getByText('Coming soon')).toBeDefined()
    // The claim the tags make: nothing here is reachable yet. A tile that became a
    // link or a button while still carrying its tag would be the page contradicting
    // itself, and that is the regression worth catching.
    expect(within(tile).queryByRole('link')).toBeNull()
    expect(within(tile).queryByRole('button')).toBeNull()
  }
})
