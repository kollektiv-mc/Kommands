import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TileHandles } from './TileHandles'
import { DEFAULT_SIZES, type Measured } from './tileSizes'

const measured: Measured = { left: 240, right: 300, viewWidth: 800, viewHeight: 600, command: 66 }

function drag(el: HTMLElement, dx: number, dy: number) {
  el.setPointerCapture = () => {}
  fireEvent.pointerDown(el, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
  act(() => {
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + dx, clientY: 100 + dy }))
    el.dispatchEvent(new MouseEvent('pointerup'))
  })
}

describe('the tile handles', () => {
  test('a corner resizes a tile and the command at once', () => {
    const onResize = vi.fn()
    render(<TileHandles sizes={DEFAULT_SIZES} measure={() => measured} onResize={onResize} />)
    drag(screen.getByRole('separator', { name: 'Resize the inspector and the command' }), -20, -36)
    expect(onResize).toHaveBeenLastCalledWith({ left: null, right: 320, command: 102 })
  })

  test('a double-click puts the size back', () => {
    const onResize = vi.fn()
    const sizes = { left: 300, right: null, command: 84 }
    render(<TileHandles sizes={sizes} measure={() => measured} onResize={onResize} />)
    fireEvent.doubleClick(screen.getByRole('separator', { name: 'Resize the Shapes tile' }))
    expect(onResize).toHaveBeenCalledWith({ left: null, right: null, command: 84 })
  })
})
