/**
 * The hero's DOM and motion primitives: an abortable clock, element builders, the
 * icons it draws, and the FLIP and glide moves every scene uses.
 */
import type { HeroShape } from './types'

export const ABORT = Symbol('abort')

/** The one curve every change of size rides (docs/home-page.md § Motion rule). */
export const EASE = 'cubic-bezier(.45,0,.2,1)'
export const GLIDE_MS = 1000

export interface Clock {
  aborted: boolean
  fast: boolean
  wait: (ms: number) => Promise<void>
}

export function clock(fast: boolean): Clock {
  const c: Clock = {
    aborted: false,
    fast,
    wait: (ms) =>
      new Promise((resolve, reject) => {
        if (c.aborted) return reject(ABORT)
        if (c.fast) {
          void Promise.resolve().then(() => (c.aborted ? reject(ABORT) : resolve()))
          return
        }
        const start = performance.now()
        const tick = (now: number) => {
          if (c.aborted) return reject(ABORT)
          if (now - start >= ms) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
  }
  return c
}

// ── DOM ─────────────────────────────────────────────────────────────────────

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.append(...children)
  return node
}

export function find(root: ParentNode, selector: string): HTMLElement {
  const node = root.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`hero: no ${selector}`)
  return node
}

export function findAll(root: ParentNode, selector: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)]
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A small line icon, drawn in currentColor. */
function icon(size: number, view: string, draw: (svg: SVGSVGElement) => void): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', view)
  svg.setAttribute('aria-hidden', 'true')
  draw(svg)
  return svg
}

function shape(svg: SVGSVGElement, tag: string, attrs: Record<string, string>) {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  svg.append(node)
}

const stroke = (width: string) => ({ fill: 'none', stroke: 'currentColor', 'stroke-width': width })

export const chevron = () =>
  icon(9, '0 0 10 10', (s) => shape(s, 'path', { d: 'M2 3.5 5 6.5 8 3.5', ...stroke('1.4') }))
export const play = () =>
  icon(9, '0 0 10 10', (s) => shape(s, 'path', { d: 'M3 2v6l5-3z', fill: 'currentColor' }))
export const cursorIcon = () =>
  icon(20, '0 0 20 24', (s) => {
    s.setAttribute('height', '24')
    shape(s, 'path', {
      d: 'M3 2v17l4.4-4.1 3 6.6 3-1.4-3-6.4h6z',
      fill: 'currentColor',
      stroke: 'var(--bg-base)',
      'stroke-width': '1.3',
      'stroke-linejoin': 'round',
    })
  })

export const OBJECT_ICONS: Record<NonNullable<HeroShape['object']>['name'], () => SVGSVGElement> = {
  Sphere: () =>
    icon(13, '0 0 14 14', (s) => {
      shape(s, 'circle', { cx: '7', cy: '7', r: '5.5', ...stroke('1.4') })
      shape(s, 'ellipse', { cx: '7', cy: '7', rx: '5.5', ry: '2', ...stroke('1') })
    }),
  Cylinder: () =>
    icon(13, '0 0 14 14', (s) => {
      shape(s, 'ellipse', { cx: '7', cy: '3.5', rx: '5', ry: '2', ...stroke('1.3') })
      shape(s, 'path', { d: 'M2 3.5v7c0 1.1 2.2 2 5 2s5-.9 5-2v-7', ...stroke('1.3') })
    }),
  Box: () =>
    icon(13, '0 0 14 14', (s) =>
      shape(s, 'path', {
        d: 'M7 1.5l5 2.5v6L7 12.5 2 10V4z M2 4l5 2.5L12 4 M7 6.5v6',
        ...stroke('1.2'),
        'stroke-linejoin': 'round',
      }),
    ),
}

/** A part of the command, hidden (`wait`) until it is typed. */
// ── Motion helpers ──────────────────────────────────────────────────────────

/** Animate elements from where they were to where `mutate` leaves them. */
export function flipMove(
  els: HTMLElement[],
  mutate: () => void,
  fast: boolean,
  ms = GLIDE_MS,
  easing = EASE,
) {
  const before = new Map(els.map((e) => [e, e.getBoundingClientRect()]))
  mutate()
  if (fast) return
  for (const [e, b] of before) {
    if (!e.isConnected) continue
    const n = e.getBoundingClientRect()
    const dx = b.left - n.left
    const dy = b.top - n.top
    if (Math.abs(dx) + Math.abs(dy) < 0.5) continue
    e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration: ms,
      easing,
      composite: 'add',
    })
  }
}

export const size = (e: HTMLElement): [number, number] => {
  const r = e.getBoundingClientRect()
  return [r.width, r.height]
}

/** Release a box pinned by `glideBox` to its natural size. */
export function unpin(e: HTMLElement) {
  e.classList.remove('pin')
  e.style.removeProperty('overflow')
  e.style.removeProperty('width')
  e.style.removeProperty('height')
}

/**
 * Pin a part to its current size, run `mutate`, then glide the box to `to` (or to its
 * natural size after the change). One box, one curve: nothing inside it can make it
 * jiggle.
 */
export function glideBox(e: HTMLElement, mutate: () => void, to?: [number, number]) {
  const [w, h] = size(e)
  mutate()
  const end = to ?? size(e)
  e.classList.add('pin')
  e.style.overflow = 'hidden'
  e.style.width = `${w}px`
  e.style.height = `${h}px`
  void e.offsetWidth
  e.style.width = `${end[0]}px`
  e.style.height = `${end[1]}px`
}

/**
 * Text the tile shows elsewhere (an item's components, an NBT compound) fades in place
 * while the box closes to the size it has without it.
 */
