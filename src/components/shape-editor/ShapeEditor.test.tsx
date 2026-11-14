import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { ShapeEditor } from './ShapeEditor'

/**
 * The editor's DOM: what the palette, the layer list, the inspector and the command bar
 * do to the document, and the keys.
 *
 * The 3D stage is mocked for the reason `PreviewCanvas.test.tsx` gives: jsdom has no
 * WebGL, and nothing the stage draws is DOM. The lowering itself is tested against its
 * oracle in `worldedit/stack/lower.test.ts`; here the command is only read back.
 */
vi.mock('./viewport/ViewportStage', () => ({ default: () => <div data-testid="stage" /> }))

const store = () => useShapeEditorStore.getState()
const command = () => screen.getByRole('status', { name: 'Command' }).textContent ?? ''
function layerRows(): HTMLElement[] {
  const tree = screen.queryByRole('tree', { name: 'Layers' })
  return tree ? within(tree).queryAllByRole('treeitem') : []
}

function open(onDone = vi.fn()) {
  const user = userEvent.setup()
  render(<ShapeEditor onDone={onDone} />)
  return { user, onDone }
}

beforeEach(() => store().load({ layers: [], pattern: 'stone', hollow: false, round: false }))

describe('the shape editor', () => {
  test('a palette tile adds a layer and the command follows', async () => {
    const { user } = open()
    const empty = command()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    expect(layerRows()).toHaveLength(1)
    expect(command()).not.toBe(empty)
    expect(command()).toMatch(/^\/\/generate stone /)
  })

  test('Delete removes the selected layer and Ctrl+Z restores it', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Box' }))
    await user.keyboard('{Delete}')
    expect(layerRows()).toHaveLength(0)
    await user.keyboard('{Control>}z{/Control}')
    expect(layerRows()).toHaveLength(1)
  })

  test('a key typed into a field is not an editor shortcut', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Box' }))
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 's')
    expect(store().isolate).toBeNull()
    await user.click(screen.getByRole('tree', { name: 'Layers' }))
    await user.keyboard('s')
    expect(store().isolate).toBe(store().layers[0]?.id)
  })

  test('the inspector renames the layer when the field leaves', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Moon{Enter}')
    expect(store().layers[0]?.name).toBe('Moon')
  })

  test('the op badge cycles the layer through Add, Cut, Overlap', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    const badge = () => within(layerRows()[0]!).getByRole('button', { name: /^Operation/ })
    const seen = [badge().getAttribute('aria-label')]
    for (const _ of [1, 2]) {
      await user.click(badge())
      seen.push(badge().getAttribute('aria-label'))
    }
    expect(seen).toEqual(['Operation: Add', 'Operation: Cut', 'Operation: Overlap'])
  })

  test('a hidden layer leaves the command', async () => {
    const { user } = open()
    const empty = command()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    await user.click(within(layerRows()[0]!).getByRole('button', { name: 'Hide' }))
    expect(command()).toBe(empty)
  })

  test('Hollow writes the -h flag', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    expect(command()).not.toMatch(/ -h /)
    await user.click(screen.getByRole('switch', { name: /Hollow/ }))
    expect(command()).toMatch(/^\/\/generate -h stone /)
  })

  test('Done hands back the command on screen', async () => {
    const { user, onDone } = open()
    await user.click(screen.getByRole('button', { name: 'Add Torus' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onDone.mock.calls[0]?.[0].text).toBe(command())
  })

  test('the toolbar undo is disabled until there is a step', async () => {
    const { user } = open()
    const undo = screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' })
    expect(undo.disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    expect(undo.disabled).toBe(false)
    await user.click(undo)
    expect(layerRows()).toHaveLength(0)
    act(() => store().redo())
    expect(layerRows()).toHaveLength(1)
  })

  test('a right-click menu lights one item, the one pointed at', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    await user.pointer({
      keys: '[MouseRight]',
      target: layerRows()[0]!.querySelector('[data-row]')!,
    })
    const menu = screen.getByRole('menu')
    expect(document.activeElement).toBe(menu)
    await user.hover(within(menu).getByRole('menuitem', { name: 'Duplicate' }))
    const lit = () =>
      within(menu)
        .getAllByRole('menuitem')
        .filter((i) => i === document.activeElement)
    expect(lit().map((i) => i.textContent)).toEqual(['Duplicate'])
    await user.keyboard('{ArrowDown}')
    expect(lit().map((i) => i.textContent)).toEqual(['Delete'])
  })

  test('Clear all asks first, and Undo brings the layers back', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    await user.click(screen.getByRole('button', { name: 'Add Box' }))
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('tree', { name: 'Layers' }),
    })
    await user.click(screen.getByRole('menuitem', { name: 'Clear all' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Clear all shapes?' })
    expect(document.activeElement?.textContent).toBe('Cancel')
    await user.click(within(dialog).getByRole('button', { name: 'Clear all' }))
    expect(layerRows()).toHaveLength(0)
    await user.keyboard('{Control>}z{/Control}')
    expect(layerRows()).toHaveLength(2)
  })

  test('the chevron folds a group without selecting it', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Add Group' }))
    act(() => store().select(null))
    await user.click(screen.getByRole('button', { name: 'Fold' }))
    expect(screen.getByRole('button', { name: 'Unfold' })).toBeTruthy()
    expect(store().selected).toBeNull()
  })
})
