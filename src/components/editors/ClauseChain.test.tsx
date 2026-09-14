import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ClauseChain from './ClauseChain'

/**
 * The chain editor on its own, driven directly rather than through the renderer.
 *
 * Mounted without `React.lazy` here, which is why these are synchronous while
 * `CommandWorkbench.test.tsx` has to `findBy` its way past a Suspense fallback. The
 * boundary is the renderer's concern and is asserted there; this file is about what
 * the chain does once it is on screen.
 */
const ids = ['i0', 'i1', 'i2']

function renderChain(overrides: Partial<Parameters<typeof ClauseChain>[0]> = {}) {
  const onReorder = vi.fn()
  const onAdd = vi.fn()
  render(
    <ClauseChain
      ids={ids}
      min={0}
      naming={(id) => ({ label: `clause ${id}` })}
      renderClause={(id) => <span>body {id}</span>}
      onReorder={onReorder}
      onAdd={onAdd}
      {...overrides}
    />,
  )
  return { onReorder, onAdd }
}

test('draws a node per instance, in order, with its clause inside', () => {
  renderChain()

  // The label comes from `naming`, so the chain never resolves a branch itself — that
  // is the renderer's job and the reason this component knows nothing about the schema.
  expect(screen.getByText('clause i0')).toBeDefined()
  expect(screen.getByText('body i2')).toBeDefined()

  const positions = screen.getAllByRole('listitem')
  expect(positions).toHaveLength(3)
})

test('renders authored help when the definition carries it, and nothing when it does not', () => {
  renderChain({ naming: (id) => ({ label: id, help: id === 'i1' ? 'what it does' : undefined }) })

  expect(screen.getByText('what it does')).toBeDefined()
  expect(screen.queryByText('undefined')).toBeNull()
})

test('the keyboard controls hand back a permutation, not an index and a verb', async () => {
  const user = userEvent.setup()
  const { onReorder } = renderChain()

  await user.click(screen.getByLabelText('Move clause 2 earlier'))
  expect(onReorder).toHaveBeenCalledWith(['i1', 'i0', 'i2'])

  // A different pair, so the two assertions cannot both pass on one wrong answer:
  // moving clause 2 earlier and clause 1 later produce the same list, which would make
  // a second assertion about them prove nothing.
  await user.click(screen.getByLabelText('Move clause 3 earlier'))
  expect(onReorder).toHaveBeenLastCalledWith(['i0', 'i2', 'i1'])
})

test('removal is a permutation with one id left out', async () => {
  const user = userEvent.setup()
  const { onReorder } = renderChain()

  await user.click(screen.getByLabelText('Remove clause 2'))
  // Not "remove index 1": to a path-keyed tree removing and reordering are one
  // operation, and the store clears only the ids that are missing from the new list.
  expect(onReorder).toHaveBeenCalledWith(['i0', 'i2'])
})

test('the moves at the ends of the chain are offered but inert', () => {
  renderChain()

  expect(screen.getByLabelText<HTMLButtonElement>('Move clause 1 earlier').disabled).toBe(true)
  expect(screen.getByLabelText<HTMLButtonElement>('Move clause 3 later').disabled).toBe(true)
  expect(screen.getByLabelText<HTMLButtonElement>('Move clause 2 earlier').disabled).toBe(false)
})

test('removal is not offered at min, and adding is not offered at max', () => {
  const { rerender } = render(
    <ClauseChain
      ids={ids}
      min={3}
      max={3}
      naming={(id) => ({ label: id })}
      renderClause={() => null}
      onReorder={vi.fn()}
      onAdd={vi.fn()}
    />,
  )

  // Both limits are facts about the command's grammar rather than about a value
  // someone typed, so the control that would break one is absent rather than disabled.
  expect(screen.queryByLabelText('Remove clause 1')).toBeNull()
  expect(screen.queryByLabelText('Add clause')).toBeNull()

  rerender(
    <ClauseChain
      ids={ids}
      min={0}
      naming={(id) => ({ label: id })}
      renderClause={() => null}
      onReorder={vi.fn()}
      onAdd={vi.fn()}
    />,
  )
  expect(screen.getByLabelText('Remove clause 1')).toBeDefined()
  expect(screen.getByLabelText('Add clause')).toBeDefined()
})

test('every clause carries a drag handle, and it is a real control', () => {
  renderChain()

  // A button rather than a div with a pointer handler. The pointer gesture itself is
  // not asserted here: jsdom answers getBoundingClientRect with zeroes, so a simulated
  // drag would be measured against a layout that does not exist. The arithmetic it
  // drives is pinned in lib/reorder.test.ts instead.
  const handle = screen.getByLabelText('Reorder clause 1')
  expect(handle.tagName).toBe('BUTTON')
})

test('adding asks the caller, which is what enforces max', async () => {
  const user = userEvent.setup()
  const { onAdd } = renderChain()

  await user.click(screen.getByLabelText('Add clause'))
  expect(onAdd).toHaveBeenCalledOnce()
})
