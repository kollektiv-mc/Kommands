import { afterEach, expect, test, vi } from 'vitest'
import { flipIn, flipOut } from './flip'
import type { OriginRect } from '../stores/useUiStore'

afterEach(() => vi.unstubAllGlobals())

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
}

/** A panel with a real rect, which jsdom will not lay one out for. */
function panelOf(rect: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement('div')
  element.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height }) as DOMRect
  return element
}

const ORIGIN: OriginRect = { top: 100, left: 200, width: 150, height: 100 }

/**
 * The transform a run *starts* from.
 *
 * `flipIn` sets the start and the end in one call, so the start is only observable by
 * watching the assignment. Patching the setter is how a test sees the frame the
 * browser animates away from.
 */
function starts(panel: HTMLElement, run: () => void): string {
  const seen: string[] = []
  const style = panel.style
  const original = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'transform')!
  Object.defineProperty(style, 'transform', {
    configurable: true,
    get: () => original.get!.call(style),
    set: (value: string) => {
      seen.push(value)
      original.set!.call(style, value)
    },
  })
  run()
  delete (style as unknown as Record<string, unknown>).transform
  // [reset, start, end] — the middle one is what the animation runs from.
  return seen.find((v) => v !== '' && v !== 'translate(0px, 0px) scale(1, 1)') ?? '(none)'
}

test('the panel starts transformed onto its origin, then is released', () => {
  stubReducedMotion(false)
  const panel = panelOf({ top: 0, left: 0, width: 600, height: 400 })

  // 150/600 across and 100/400 down, centre to centre: the panel is put back exactly
  // over the tile that opened it, which is the whole of FLIP's first half.
  expect(starts(panel, () => flipIn(panel, ORIGIN))).toBe(
    'translate(-25px, -50px) scale(0.25, 0.25)',
  )
  // And released in the same call — the end state is what the browser animates toward.
  expect(panel.style.transform).toBe('translate(0px, 0px) scale(1, 1)')
  expect(panel.style.opacity).toBe('1')
  expect(panel.style.transition).toContain('transform')
})

test('the transform is stripped once the animation lands', () => {
  vi.useFakeTimers()
  stubReducedMotion(false)
  const panel = panelOf({ top: 0, left: 0, width: 600, height: 400 })

  flipIn(panel, ORIGIN)
  vi.advanceTimersByTime(300)

  // Not tidiness. Chromium allocates a WebGL compositing layer at the size the element
  // had when a transform was applied, so a panel left at `scale(1,1)` gets a canvas
  // sized to the flip's starting rect and never fills. PreviewCanvas is exactly the
  // kind of child that breaks on.
  expect(panel.style.transform).toBe('')
  expect(panel.style.transition).toBe('')
  vi.useRealTimers()
})

test('no origin still animates, rather than cutting', () => {
  stubReducedMotion(false)
  const panel = panelOf({ top: 0, left: 0, width: 600, height: 400 })

  flipIn(panel, null)

  // The editor is reachable by URL, where there is no tile to grow from. An entrance
  // that sometimes animates and sometimes cuts reads as a glitch; the same gesture at
  // less detail reads as one design.
  expect(panel.style.transform).toBe('translate(0px, 0px) scale(1, 1)')
})

test('reduced motion touches nothing at all', () => {
  stubReducedMotion(true)
  const panel = panelOf({ top: 0, left: 0, width: 600, height: 400 })

  flipIn(panel, ORIGIN)

  expect(panel.style.transform).toBe('')
  expect(panel.style.opacity).toBe('')
})

test('a panel with no layout is left alone rather than transformed to NaN', () => {
  stubReducedMotion(false)
  // The zero-size case is not hypothetical: it is every environment without layout,
  // jsdom included. Dividing by it yields `scale(NaN, NaN)`, which renders nothing at
  // all and looks like the panel failing to mount.
  const panel = panelOf({ top: 0, left: 0, width: 0, height: 0 })

  flipIn(panel, ORIGIN)
  expect(panel.style.transform).toBe('')
})

test('running twice on the same panel animates the same way both times', () => {
  stubReducedMotion(false)
  // The StrictMode case, and a real bug rather than a hypothetical one. React re-runs
  // effects on the *same* DOM node, and `getBoundingClientRect` reports the
  // transformed box — so the second run used to measure a panel already sitting on the
  // origin, compute `scale(1, 1)`, and animate nothing. Every tile-to-editor open was
  // silently the identity transform.
  //
  // The measurement is what has to be stable, so the fake rect answers honestly: it
  // reports the origin box whenever a transform is set, exactly as a browser does.
  const layout = { top: 0, left: 0, width: 600, height: 400 }
  const panel = document.createElement('div')
  panel.getBoundingClientRect = () => {
    const box = panel.style.transform === '' ? layout : ORIGIN
    return { ...box, right: box.left + box.width, bottom: box.top + box.height } as DOMRect
  }

  const first = starts(panel, () => flipIn(panel, ORIGIN))
  const second = starts(panel, () => flipIn(panel, ORIGIN))
  expect(second).toBe(first)
  expect(first).toBe('translate(-25px, -50px) scale(0.25, 0.25)')
})

test('the exit puts the panel back over its origin, then hands back', () => {
  vi.useFakeTimers()
  stubReducedMotion(false)
  const panel = panelOf({ top: 0, left: 0, width: 600, height: 400 })
  const done = vi.fn()

  flipOut(panel, ORIGIN, null, done)

  expect(panel.style.transform).toBe('translate(-25px, -50px) scale(0.25, 0.25)')
  expect(panel.style.opacity).toBe('0')
  // Not yet — navigating before the animation finishes unmounts the thing being
  // animated, which is the whole reason `done` is a callback rather than a return.
  expect(done).not.toHaveBeenCalled()

  // Past the 130ms transition but not past the margin. The margin is the fix for a
  // real Chromium finding: the transition starts at the next style recalc rather than
  // when this timer does, so handing back at exactly OUT_MS unmounted the panel with
  // its last stretch of travel unrun — the collapse stopped two thirds of the way back
  // to the tile. Asserting the gap is what stops that being tuned back out.
  vi.advanceTimersByTime(130)
  expect(done).not.toHaveBeenCalled()

  vi.advanceTimersByTime(70)
  expect(done).toHaveBeenCalledOnce()
  vi.useRealTimers()
})

test('the exit always hands back, even when it cannot animate', () => {
  // The one asymmetry with flipIn, and the reason it matters: flipIn may decline to
  // animate and nothing is lost, but an exit that declines strands the caller
  // mid-close. Escape would do nothing at all — in every environment without layout,
  // which includes every test in this suite.
  stubReducedMotion(true)
  const reduced = vi.fn()
  flipOut(panelOf({ top: 0, left: 0, width: 600, height: 400 }), ORIGIN, null, reduced)
  expect(reduced).toHaveBeenCalledOnce()

  stubReducedMotion(false)
  const zeroSized = vi.fn()
  flipOut(panelOf({ top: 0, left: 0, width: 0, height: 0 }), ORIGIN, null, zeroSized)
  expect(zeroSized).toHaveBeenCalledOnce()

  const noPanel = vi.fn()
  flipOut(null, ORIGIN, null, noPanel)
  expect(noPanel).toHaveBeenCalledOnce()
})

test('the backdrop fades with the panel', () => {
  stubReducedMotion(false)
  const backdrop = document.createElement('div')
  flipOut(panelOf({ top: 0, left: 0, width: 600, height: 400 }), ORIGIN, backdrop, () => {})

  // Driven from here rather than from a Tailwind arbitrary duration, so every bespoke
  // timing stays in this one documented file and the duration grep finds nothing.
  expect(backdrop.style.opacity).toBe('0')
  expect(backdrop.style.transition).toContain('opacity')
})
