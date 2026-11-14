import { StrictMode } from 'react'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useSheetSize } from './useSheetSize'

/**
 * jsdom lays nothing out, so each element's box is read from here by its `data-part`.
 * Enough to drive the hook: the room the sheet sits in, its header band, the content.
 */
let boxes: Record<string, { w: number; h: number }> = {}
const box = (el: HTMLElement) => boxes[el.dataset.part ?? '']
const measured = ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight'] as const
const saved = measured.map((key) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))

/** Every ResizeObserver callback the hook set up, to call when a size "changes". */
let observers: (() => void)[] = []
const resize = () => act(() => observers.forEach((notify) => notify()))
const animate = vi.fn(() => ({ cancel() {}, playState: 'running', effect: null }))

beforeAll(() => {
  for (const key of measured) {
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get(this: HTMLElement) {
        const b = box(this)
        return b ? (key.endsWith('Width') ? b.w : b.h) : 0
      },
    })
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private notify: () => void) {
        observers.push(notify)
      }
      observe() {}
      disconnect() {
        observers = observers.filter((notify) => notify !== this.notify)
      }
    },
  )
  HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate']
})

afterAll(() => {
  measured.forEach((key, i) => {
    // `clientWidth` and `clientHeight` are Element's, so HTMLElement had none of its own.
    const own = saved[i]
    if (own) Object.defineProperty(HTMLElement.prototype, key, own)
    else Reflect.deleteProperty(HTMLElement.prototype, key)
  })
  vi.unstubAllGlobals()
})

beforeEach(() => {
  observers = []
  animate.mockClear()
  boxes = { room: { w: 1000, h: 800 }, band: { w: 400, h: 40 }, content: { w: 400, h: 300 } }
})

function Sheet() {
  const { stage, sheet, header, frame, content } = useSheetSize<HTMLDivElement>()
  return (
    <div ref={stage} data-part="room">
      <div ref={sheet}>
        <div ref={header} data-part="band" />
        <div ref={frame}>
          <div ref={content} data-part="content" />
        </div>
      </div>
    </div>
  )
}

const content = (view: ReturnType<typeof render>) =>
  view.container.querySelector<HTMLElement>('[data-part="content"]')!

test('a content that fits does not clip its tiles', () => {
  // A shrinking content takes its new size at once, while its tiles still leave and
  // slide where the old size had them: clipped to the new one, they were cut off.
  expect(content(render(<Sheet />)).style.overflow).toBe('visible')
})

test('a content the room caps scrolls', () => {
  boxes.content = { w: 400, h: 760 }
  expect(content(render(<Sheet />)).style.overflow).toBe('auto')
})

test('a content that grows past the room starts to scroll', () => {
  const view = render(<Sheet />)
  boxes.content = { w: 400, h: 760 }
  resize()
  expect(content(view).style.overflow).toBe('auto')
})

test('a scrolled content keeps its scroll while it moves', () => {
  boxes.content = { w: 400, h: 760 }
  const view = render(<Sheet />)
  content(view).scrollTop = 40
  boxes.content = { w: 400, h: 300 }
  resize()
  expect(content(view).style.overflow).toBe('auto')
})

test('the first change after StrictMode opens it animates', () => {
  // StrictMode runs the effect twice. The second run found the size the first wrote,
  // and the first real change then snapped instead of gliding.
  render(
    <StrictMode>
      <Sheet />
    </StrictMode>,
  )
  expect(animate).not.toHaveBeenCalled()
  boxes.content = { w: 400, h: 200 }
  resize()
  expect(animate).toHaveBeenCalledTimes(1)
})
