import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_EDIT, DEFAULT_VIEW, useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { group, reference, shape } from '../../worldedit/stack/make'
import type { StageProps } from './viewport/ViewportStage'
import { ShapeEditor } from './ShapeEditor'

/**
 * What the view is asked to draw. The stage itself is WebGL and mocked, as in
 * `ShapeEditor.test.tsx`; the mock keeps the props it was last given.
 */
const stage: { props: StageProps | null } = { props: null }
vi.mock('./viewport/ViewportStage', () => ({
  default: (props: StageProps) => {
    stage.props = props
    return <div data-testid="stage" />
  },
}))

const store = () => useShapeEditorStore.getState()

beforeEach(() => {
  stage.props = null
  store().load({ layers: [], pattern: 'stone', hollow: false, round: false })
  store().setView(DEFAULT_VIEW)
  store().setEdit(DEFAULT_EDIT)
})

describe('the view', () => {
  test('the View menu changes what is drawn and stays open', async () => {
    const user = userEvent.setup()
    render(<ShapeEditor onDone={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'View' }))
    const show = screen.getByRole('group', { name: 'Show' })
    await user.click(within(show).getByRole('button', { name: 'Shapes' }))
    await user.click(screen.getByRole('button', { name: 'Player' }))
    expect(store().view).toMatchObject({ show: 'shapes', player: true })
    expect(screen.getByRole('button', { name: 'Player' }).getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull()
  })

  test('isolating a layer draws it alone', () => {
    const a = shape('sphere', { name: 'A' })
    const b = shape('box', { name: 'B' })
    store().load({ layers: [a, b], pattern: 'stone', hollow: false, round: false })
    render(<ShapeEditor onDone={vi.fn()} />)
    expect(stage.props?.layers.map((l) => l.name)).toEqual(['A', 'B'])
    act(() => store().setIsolate(b.id))
    expect(stage.props?.layers.map((l) => l.name)).toEqual(['B'])
  })

  test('a reference is evaluated, unless it is hidden', () => {
    const shown = reference({ name: 'Roof', command: '//generate copper_block y>0.5' })
    const hidden = group([reference({ name: 'Gone', command: '//generate dirt y<0' })])
    store().load({
      layers: [shown, { ...hidden, visible: false }],
      pattern: 'stone',
      hollow: false,
      round: false,
    })
    render(<ShapeEditor onDone={vi.fn()} />)
    const refs = stage.props?.references
    expect([...(refs?.keys() ?? [])]).toEqual(['//generate copper_block y>0.5'])
    expect(refs?.get('//generate copper_block y>0.5')).toMatchObject({
      state: 'ready',
      pattern: 'copper_block',
    })
  })
})

describe('Edit mode', () => {
  const pressed = (group: string, name: RegExp) =>
    within(screen.getByRole('group', { name: group }))
      .getByRole('button', { name })
      .getAttribute('aria-pressed')

  test('Enter edits, W E R pick the gizmo, Escape steps back', async () => {
    const user = userEvent.setup()
    const a = shape('sphere', { name: 'A' })
    store().load({ layers: [a], pattern: 'stone', hollow: false, round: false })
    store().select(a.id)
    render(<ShapeEditor onDone={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Gizmo' })).toBeNull()
    await user.keyboard('{Enter}')
    expect(pressed('Mode', /^Edit/)).toBe('true')
    await user.keyboard('e')
    expect(pressed('Gizmo', /^Rotate/)).toBe('true')
    await user.keyboard('r')
    expect(store().edit.mode).toBe('scale')
    await user.keyboard('{Escape}')
    expect(pressed('Mode', /^View/)).toBe('true')
    expect(store().selected).toBe(a.id)
    await user.keyboard('{Escape}')
    expect(store().selected).toBeNull()
  })

  test('Enter on a focused button presses only the button', async () => {
    const user = userEvent.setup()
    render(<ShapeEditor onDone={vi.fn()} />)
    within(screen.getByRole('group', { name: 'Mode' }))
      .getByRole('button', { name: /^View/ })
      .focus()
    await user.keyboard('{Enter}')
    expect(store().edit.on).toBe(false)
  })

  test('the Snap menu sets the steps and turns Snap on', async () => {
    const user = userEvent.setup()
    act(() => store().setEdit({ on: true, snap: false }))
    render(<ShapeEditor onDone={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Snap settings' }))
    const rotate = screen.getByRole('group', { name: 'Rotate' })
    await user.click(within(rotate).getByRole('button', { name: '45°' }))
    expect(store().edit).toMatchObject({ turn: 45, snap: true })
    await user.click(screen.getByRole('button', { name: 'Blocks' }))
    const move = screen.getByRole('group', { name: 'Move' })
    expect(within(move).getByRole('button', { name: '0.05' })).toHaveProperty('disabled', true)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Rotate' })).toBeNull()
    expect(store().edit.on).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Snap' }))
    expect(store().edit.snap).toBe(false)
  })
})
