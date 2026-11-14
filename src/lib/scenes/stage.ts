/**
 * A scene's stage: a fixed 960 × 600 desktop, scaled to its box, where app windows
 * open and close and a cursor moves between them.
 *
 * Every position here is in that logical space, so a scene is written once in the
 * prototype's coordinates and plays the same at any width. A scene drives it through
 * `Stage`: move the cursor to an element or a point, click, type into an element,
 * open a window, bring one forward.
 */
import { cursorIcon, el, findAll, type Clock } from '../hero/dom'

export const STAGE_W = 960
export const STAGE_H = 600

export type Point = [number, number]

/** A window's box on the stage. */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** The cursor starts, and returns at each scene, at the stage's lower right. */
const CURSOR_HOME: Point = [900, 560]

export interface Stage {
  root: HTMLElement
  fast: boolean
  wait: (ms: number) => Promise<void>
  /** An element's centre, in stage coordinates. */
  centre: (target: Element) => Point
  /** Replace the stage's windows; those not marked `opening` open at once. */
  mount: (...windows: HTMLElement[]) => void
  to: (target: Element | Point, ms?: number) => Promise<void>
  click: () => Promise<void>
  type: (target: HTMLElement, text: string, ms?: number) => Promise<void>
  open: (win: HTMLElement) => Promise<void>
  raise: (front: HTMLElement, back: HTMLElement) => void
}

/** A window on the stage, placed at `box`; `opening` holds it closed until `open`. */
export function stageWindow(box: Box, className: string, content: HTMLElement): HTMLElement {
  const win = el('div', `sc-win ${className}`, content)
  win.style.left = `${box.left}px`
  win.style.top = `${box.top}px`
  win.style.width = `${box.width}px`
  win.style.height = `${box.height}px`
  return win
}

export function stage(root: HTMLElement, c: Clock): Stage {
  const cursor = el('div', 'sc-cursor', cursorIcon())
  let pos: Point = CURSOR_HOME
  const place = () => {
    cursor.style.transform = `translate(${pos[0] - 3}px, ${pos[1] - 2}px)`
  }
  const scale = () => root.getBoundingClientRect().width / STAGE_W || 1

  const centre = (target: Element): Point => {
    const r = target.getBoundingClientRect()
    const o = root.getBoundingClientRect()
    const k = scale()
    return [(r.left - o.left + r.width / 2) / k, (r.top - o.top + r.height / 2) / k]
  }

  return {
    root,
    fast: c.fast,
    wait: c.wait,
    centre,
    mount(...windows) {
      root.replaceChildren(...windows, cursor)
      cursor.style.transitionDuration = '0ms'
      pos = CURSOR_HOME
      place()
      if (c.fast) {
        windows.forEach((w) => w.classList.remove('opening'))
        return
      }
      const open = windows.filter((w) => !w.classList.contains('opening'))
      open.forEach((w) => w.classList.add('opening'))
      void root.offsetWidth
      open.forEach((w) => w.classList.remove('opening'))
    },
    async to(target, ms = 650) {
      pos = Array.isArray(target) ? target : centre(target)
      cursor.style.transitionDuration = c.fast ? '0ms' : `${ms}ms`
      place()
      await c.wait(ms)
    },
    async click() {
      cursor.classList.add('down')
      if (!c.fast) {
        const ripple = el('div', 'sc-ripple')
        ripple.style.left = `${pos[0]}px`
        ripple.style.top = `${pos[1]}px`
        root.append(ripple)
        ripple.addEventListener('animationend', () => ripple.remove())
      }
      await c.wait(140)
      cursor.classList.remove('down')
      await c.wait(80)
    },
    async type(target, text, ms = 38) {
      if (c.fast) {
        target.textContent = text
        return
      }
      for (let i = 1; i <= text.length; i++) {
        target.textContent = text.slice(0, i)
        await c.wait(ms)
      }
    },
    async open(win) {
      if (c.fast) return win.classList.remove('opening')
      await c.wait(550)
      win.classList.remove('opening')
      await c.wait(850)
    },
    raise(front, back) {
      back.classList.replace('front', 'back')
      front.classList.replace('back', 'front')
    },
  }
}

/** Every window leaves before the next scene's arrive. */
export async function closeAll(root: HTMLElement, c: Clock, ms: number) {
  const windows = findAll(root, '.sc-win')
  if (c.fast || windows.length === 0) return
  windows.forEach((w) => w.classList.add('closing'))
  findAll(root, '.sc-cursor').forEach((k) => k.classList.add('gone'))
  await c.wait(ms)
}
