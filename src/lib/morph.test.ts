import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { morphIn, morphOut } from './morph'

/** An element with a real rect, which jsdom will not lay one out for. */
function boxed(tag: string, rect: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement(tag)
  element.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height }) as DOMRect
  return element
}

let finish: () => void
let keyframes: Keyframe[][]

beforeEach(() => {
  keyframes = []
  let resolve: () => void = () => undefined
  const finished = new Promise<void>((done) => (resolve = done))
  finish = resolve
  HTMLElement.prototype.animate = vi.fn((frames: Keyframe[]) => {
    keyframes.push(frames)
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
  const host = boxed('div', { top: 0, left: 0, width: 1000, height: 800 })
  const panel = boxed('div', { top: 200, left: 300, width: 400, height: 400 })
  const tile = boxed('li', { top: 50, left: 20, width: 200, height: 100 })
  tile.setAttribute('data-origin', 'kit')
  host.append(panel)
  document.body.append(host, tile)
  return { host, panel, tile }
}

test('the ghost starts on the tile and ends on the sheet', () => {
  const parts = setup()
  morphIn(parts, null)
  const ghost = parts.host.firstElementChild as HTMLElement
  // First in the stage, so the sheet paints over it.
  expect(ghost).not.toBe(parts.panel)
  expect(keyframes[0]![0]).toMatchObject({ top: '50px', left: '20px', width: '200px' })
  expect(keyframes[0]![1]).toMatchObject({ top: '200px', left: '300px', width: '400px' })
})

test('the sheet starts centred on the tile, clipped to its size', () => {
  const parts = setup()
  morphIn(parts, null)
  // Tile centre (120, 100), sheet centre (500, 400); the sheet is 200 by 300 bigger.
  expect(keyframes[2]![0]).toMatchObject({
    transform: 'translate(-380px, -300px)',
    clipPath: 'inset(150px 100px 150px 100px round 0px)',
    opacity: 0,
  })
})

test('the tile is hidden while it moves and back after', async () => {
  const parts = setup()
  morphIn(parts, null)
  expect(parts.tile.style.visibility).toBe('hidden')
  // A tile transitions `all`, which would hold it visible for the whole transition.
  expect(parts.tile.style.transition).toBe('none')
  finish()
  await Promise.resolve()
  await Promise.resolve()
  expect(parts.tile.style.visibility).toBe('')
  expect(parts.host.childElementCount).toBe(1)
})

test('closing lands on the tile, then navigates', async () => {
  const parts = setup()
  const done = vi.fn()
  expect(morphOut(parts, null, done)).toBe(true)
  expect(keyframes[0]![1]).toMatchObject({ top: '50px', left: '20px' })
  expect(done).not.toHaveBeenCalled()
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
  expect(parts.host.childElementCount).toBe(1)
})
