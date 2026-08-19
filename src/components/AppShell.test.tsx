import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { AppShell } from './AppShell'

test('renders the product name and its children', () => {
  render(
    <AppShell>
      <p>content</p>
    </AppShell>,
  )
  expect(screen.getByText('Kommands')).toBeDefined()
  expect(screen.getByText('content')).toBeDefined()
})
