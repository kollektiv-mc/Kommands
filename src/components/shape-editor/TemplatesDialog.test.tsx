import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TEMPLATES } from '../../data/authored/generate'
import { TemplatesDialog } from './TemplatesDialog'

vi.mock('./viewport/thumbnails', () => ({
  pictureOf: async ({ id }: { id: string }) => (id === TEMPLATES[0]?.id ? '' : `data:,${id}`),
}))

test('each card fills in its picture as it is drawn', async () => {
  render(<TemplatesDialog onPick={vi.fn()} onClose={vi.fn()} />)
  const dialog = screen.getByRole('dialog', { name: 'Templates' })
  await waitFor(() => expect(dialog.querySelectorAll('img')).toHaveLength(TEMPLATES.length - 1))
  const first = screen.getByRole('button', { name: TEMPLATES[0]!.name })
  expect(first.querySelector('img')).toBeNull()
})
