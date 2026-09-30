import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ClauseChain, { type StepKind } from './ClauseChain'

/**
 * The chain editor on its own, driven directly rather than through the renderer.
 *
 * Mounted without `React.lazy` here, which is why these are synchronous while
 * `CommandWorkbench.test.tsx` has to `findBy` its way past a Suspense fallback. The
 * boundary is the renderer's concern and is asserted there; this file is about what
 * the chain does once it is on screen.
 */
const ids = ['i0', 'i1', 'i2']

const KINDS: StepKind[] = [
  { branch: 0, label: 'as', help: 'Run as each target.', group: 'Change who or where' },
  { branch: 1, label: 'at', help: 'Move to each target.', group: 'Change who or where' },
  { branch: 2, label: 'if', help: 'Continue when it passes.', group: 'Test a condition' },
]

const naming = (id: string) => ({ label: `kind ${id}`, summary: `@${id}`, field: `/1/#${id}` })

function renderChain(overrides: Partial<Parameters<typeof ClauseChain>[0]> = {}) {
  const onReorder = vi.fn()
  const onAdd = vi.fn()
  render(
    <ClauseChain
      ids={ids}
      min={0}
      kinds={KINDS}
      naming={naming}
      renderClause={(id) => <span>body {id}</span>}
      onReorder={onReorder}
      onAdd={onAdd}
      {...overrides}
    />,
  )
  return { onReorder, onAdd }
}

test('draws a numbered step per instance, its keyword once and what it writes beside it', () => {
  renderChain()

  // The label comes from `naming`, so the chain never resolves a branch itself.
  const step = screen.getByRole('region', { name: 'Step 1, kind i0' })
  expect(within(step).getByText('kind i0')).toBeDefined()
  expect(within(step).getByText('@i0')).toBeDefined()
  expect(within(step).getByText('body i0')).toBeDefined()
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})

test('renders authored help when the definition carries it, and nothing when it does not', () => {
  renderChain({
    naming: (id) => ({ ...naming(id), help: id === 'i1' ? 'what it does' : undefined }),
  })

  expect(screen.getByText('what it does')).toBeDefined()
  expect(screen.queryByText('undefined')).toBeNull()
})

test('the move buttons hand back a permutation, not an index and a verb', async () => {
  const user = userEvent.setup()
  const { onReorder } = renderChain()

  await user.click(screen.getByRole('button', { name: 'Move step 2 earlier' }))
  expect(onReorder).toHaveBeenCalledWith(['i1', 'i0', 'i2'])

  // A different pair, so the two assertions cannot both pass on one wrong answer.
  await user.click(screen.getByRole('button', { name: 'Move step 3 earlier' }))
  expect(onReorder).toHaveBeenLastCalledWith(['i0', 'i2', 'i1'])
})

test('the arrow keys on a handle move its step, so reordering never needs a pointer', async () => {
  const user = userEvent.setup()
  const { onReorder } = renderChain()

  screen.getByRole('button', { name: 'Reorder step 1' }).focus()
  await user.keyboard('{ArrowDown}')
  expect(onReorder).toHaveBeenCalledWith(['i1', 'i0', 'i2'])
})

test('removal is a permutation with one id left out', async () => {
  const user = userEvent.setup()
  const { onReorder } = renderChain()

  await user.click(screen.getByRole('button', { name: 'Remove step 2' }))
  // Not "remove index 1": to a path-keyed tree removing and reordering are one
  // operation, and the store clears only the ids that are missing from the new list.
  expect(onReorder).toHaveBeenCalledWith(['i0', 'i2'])
})

test('the moves at the ends of the chain are offered but inert', () => {
  renderChain()

  const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
  expect(button('Move step 1 earlier').disabled).toBe(true)
  expect(button('Move step 3 later').disabled).toBe(true)
  expect(button('Move step 2 earlier').disabled).toBe(false)
})

test('removal is not offered at min, and adding is not offered at max', () => {
  const { rerender } = render(
    <ClauseChain
      ids={ids}
      min={3}
      max={3}
      kinds={KINDS}
      naming={naming}
      renderClause={() => null}
      onReorder={vi.fn()}
      onAdd={vi.fn()}
    />,
  )

  // Both limits are facts about the command's grammar rather than about a value
  // someone typed, so the control that would break one is absent rather than disabled.
  expect(screen.queryByRole('button', { name: 'Remove step 1' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add a step' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Insert a step/ })).toBeNull()

  rerender(
    <ClauseChain
      ids={ids}
      min={0}
      kinds={KINDS}
      naming={naming}
      renderClause={() => null}
      onReorder={vi.fn()}
      onAdd={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: 'Remove step 1' })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Add a step' })).toBeDefined()
})

test('every step carries a drag handle, and it is a real control', () => {
  renderChain()

  // The pointer gesture itself is not asserted here: jsdom answers
  // getBoundingClientRect with zeroes, so a simulated drag would be measured against a
  // layout that does not exist. The arithmetic it drives is in lib/reorder.test.ts.
  expect(screen.getByRole('button', { name: 'Reorder step 1' }).tagName).toBe('BUTTON')
})

test('the add menu offers the kinds by group, and adds the one picked at the end', async () => {
  const user = userEvent.setup()
  const { onAdd } = renderChain()

  await user.click(screen.getByRole('button', { name: 'Add a step' }))
  expect(screen.getByText('Change who or where')).toBeDefined()
  expect(screen.getByText('Test a condition')).toBeDefined()
  const item = screen.getByRole('button', { name: 'if' })
  expect(document.getElementById(item.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Continue when it passes.',
  )
  await user.click(item)
  // At the end, and already of that kind: one act, which the store makes one undo step.
  expect(onAdd).toHaveBeenCalledWith(3, 2)
})

test('a step can be inserted between two others, not only at the end', async () => {
  const user = userEvent.setup()
  const { onAdd } = renderChain()

  await user.click(screen.getByRole('button', { name: 'Insert a step after step 1' }))
  await user.click(screen.getByRole('button', { name: 'at' }))
  expect(onAdd).toHaveBeenCalledWith(1, 1)
})

test('a step folds away to its header, and says so', async () => {
  const user = userEvent.setup()
  renderChain()

  const fold = screen.getByRole('button', { name: 'Collapse step 2' })
  expect(fold.getAttribute('aria-expanded')).toBe('true')
  await user.click(fold)
  expect(screen.getByRole('button', { name: 'Expand step 2' }).getAttribute('aria-expanded')).toBe(
    'false',
  )
})

test('the step that ends the chain is drawn last, and cannot be moved or removed', () => {
  renderChain({
    tail: { label: 'run', summary: 'say hi', field: '/2', body: <span>run body</span> },
  })

  const last = screen.getByRole('region', { name: 'Last step, run' })
  expect(within(last).getByText('say hi')).toBeDefined()
  expect(within(last).getByText('run body')).toBeDefined()
  expect(within(last).queryByRole('button', { name: /Remove/ })).toBeNull()
})
