import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { bezier, easingOf, morphIn, morphOut } from './morph'

/** An element with a real rect, which jsdom will not lay one out for. */
function boxed(tag: string, rect: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement(tag)
  element.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height }) as DOMRect
  return element
}

let finish: () => void
/** Each animation started, by the element it runs on. */
let played: { on: Element; frames: Keyframe[]; options: KeyframeAnimationOptions }[]

beforeEach(() => {
  played = []
  let resolve: () => void = () => undefined
  const finished = new Promise<void>((done) => (resolve = done))
  finish = resolve
  HTMLElement.prototype.animate = vi.fn(function (
    this: Element,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    played.push({ on: this, frames, options })
    return { finished, cancel: () => undefined } as unknown as Animation
  }) as unknown as HTMLElement['animate']
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setup() {
  const panel = boxed('div', { top: 200, left: 300, width: 400, height: 400 })
  const body = document.createElement('div')
  const tile = boxed('li', { top: 50, left: 20, width: 200, height: 100 })
  tile.setAttribute('data-origin', 'kit')
  panel.append(document.createElement('div'), body)
  document.body.append(panel, tile)
  return { panel, body, tile }
}

const on = (element: Element) => played.find((p) => p.on === element)!
const first = (element: Element) => on(element).frames[0]!
const last = (element: Element) => on(element).frames.at(-1)!

test('the sheet starts on the tile and ends where it stands', () => {
  const parts = setup()
  morphIn(parts, null)
  expect(first(parts.panel).transform).toBe('translate(-280px, -150px) scale(0.5, 0.25)')
  expect(last(parts.panel).transform).toBe('translate(0px, 0px) scale(1, 1)')
})

test('what the sheet holds keeps its own size as it grows', () => {
  const parts = setup()
  morphIn(parts, null)
  expect(first(parts.body)).toMatchObject({ transform: 'scale(2, 4)', opacity: 0 })
  expect(last(parts.body)).toMatchObject({ transform: 'scale(1, 1)', opacity: 1 })
  const copy = parts.panel.lastElementChild!
  expect(copy).not.toBe(parts.body)
  expect(first(copy)).toMatchObject({ transform: 'scale(2, 4)', opacity: 1 })
  expect(last(copy)).toMatchObject({ opacity: 0 })
  // Copied from a tile already hidden, which it must not inherit.
  expect((copy as HTMLElement).style.visibility).toBe('')
})

test('it animates only what the compositor can', () => {
  const parts = setup()
  morphIn(parts, null)
  const properties = new Set(played.flatMap((p) => p.frames.flatMap((frame) => Object.keys(frame))))
  expect([...properties].sort()).toEqual(['opacity', 'transform'])
})

test('the tile stays hidden while the editor is open', async () => {
  const parts = setup()
  const reveal = morphIn(parts, null)!
  // A tile transitions `all`, which would hold it visible for the whole transition.
  expect(parts.tile.style.transition).toBe('none')
  finish()
  await Promise.resolve()
  await Promise.resolve()
  expect(parts.tile.style.visibility).toBe('hidden')
  expect(parts.panel.childElementCount).toBe(2)
  reveal()
  expect(parts.tile.style.visibility).toBe('')
})

test('closing lands on the tile, then shows it and navigates', async () => {
  const parts = setup()
  const done = vi.fn()
  expect(morphOut(parts, null, done)).toBe(true)
  expect(last(parts.panel).transform).toBe('translate(-280px, -150px) scale(0.5, 0.25)')
  expect(parts.tile.style.visibility).toBe('hidden')
  expect(done).not.toHaveBeenCalled()
  finish()
  await Promise.resolve()
  expect(done).toHaveBeenCalledOnce()
  expect(parts.tile.style.visibility).toBe('')
})

test('a tile already on show stays on show as it closes', async () => {
  const parts = setup()
  const done = vi.fn()
  expect(morphOut(parts, null, done, false)).toBe(true)
  expect(parts.tile.style.visibility).toBe('')
  finish()
  await Promise.resolve()
  expect(done).toHaveBeenCalledOnce()
  expect(parts.tile.style.visibility).toBe('')
})

test('reduced motion leaves it to the fallback', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  )
  const parts = setup()
  const done = vi.fn()
  expect(morphIn(parts, null)).toBeNull()
  expect(morphOut(parts, null, done)).toBe(false)
  expect(done).not.toHaveBeenCalled()
})

test('a tile with no box leaves it to the fallback', () => {
  const parts = setup()
  parts.tile.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0 }) as DOMRect
  expect(morphIn(parts, null)).toBeNull()
  expect(parts.tile.style.visibility).toBe('')
})

test('the easing is solved as CSS solves it', () => {
  const standard = easingOf('cubic-bezier(0.4, 0, 0.2, 1)')
  expect(standard(0)).toBe(0)
  expect(standard(1)).toBe(1)
  // cubic-bezier(0.4, 0, 0.2, 1) at x = 0.5 is about 0.774.
  expect(standard(0.5)).toBeCloseTo(0.774, 2)
  expect(bezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 5)
  expect(easingOf('nonsense')(0.5)).toBeCloseTo(easingOf('ease-in-out')(0.5), 5)
})
