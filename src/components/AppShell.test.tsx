import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { AppShell } from './AppShell'
import { renderWithRouter } from '../test-router'

test('renders the product name and its children', async () => {
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )
  expect(screen.getByText('Kommands')).toBeDefined()
  expect(screen.getByText('content')).toBeDefined()
})

test('the product name is the way back to the dashboard', async () => {
  await renderWithRouter(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )
  // The editor fills the viewport, so this is the only route back to what has been
  // saved. A label here rather than a link would strand anyone who opened a command.
  expect(screen.getByRole('link', { name: 'Kommands' }).getAttribute('href')).toBe('/')
})
