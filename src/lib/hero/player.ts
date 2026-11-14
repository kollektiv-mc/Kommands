/**
 * The home page's hero, played into a host element.
 *
 * A command types itself on the rows it will end on, its arguments colour in and space
 * apart, and each argument grows into the editor tile it is edited in; `//generate`
 * then drags a shape's gizmo and `/execute` slots a step in. docs/home-page.md is the
 * design, and src/data/home/hero.ts the commands.
 *
 * Imperative DOM rather than React, deliberately. Every beat measures the layout it is
 * about to animate from (the final rows are laid out once and read back, a box is
 * pinned to its current size before its insides change), and those reads have to land
 * between two specific writes. Routed through state they would land a commit later, on
 * a layout that has already moved. The host is a `div` React renders empty and never
 * touches again, the same arrangement as the dashboard's dot grid canvas.
 *
 * Under reduced motion each command is laid out in its finished state and held, and
 * the loop does not advance.
 */
import type { HeroArg, HeroCommand, HeroPart, HeroShape, ShapeState } from './types'
import {
  ABORT,
  type Clock,
  OBJECT_ICONS,
  chevron,
  clock,
  cursorIcon,
  el,
  find,
  findAll,
  flipMove,
  glideBox,
  size,
  unpin,
} from './dom'
import { drawShape, exprText, palette, playShape, renderExpr } from './shapeScene'
import { playChain, stepNode } from './chainScene'

export { exprText } from './shapeScene'

function partNode(pt: HeroPart, swatch: string | undefined): HTMLElement {
  if (pt.kind === 'literal') {
    return el('span', 'hp lit wait', el('span', 'hp-ctl', el('span', 'hv hp-vt')))
  }
  const long = Math.max(pt.value.length + (pt.raw ?? '').length, (pt.end ?? '').length) > 14
  const ctl = el('span', pt.chipsOnly ? 'hp-ctl lo' : 'hp-ctl')
  if (pt.stepper) ctl.append(el('span', 'hp-hide', '−'))
  if (pt.swatch !== undefined) {
    const sw = el('span', 'hp-sw')
    if (swatch) sw.style.backgroundColor = swatch
    ctl.append(el('span', 'hp-hide', sw))
  }
  const v = el('span', 'hv', el('span', 'hp-vt'))
  if (pt.raw !== undefined) v.append(el('span', 'hp-raw'))
  ctl.append(v)
  if (pt.dropdown) ctl.append(el('span', 'hp-hide', chevron()))
  if (pt.stepper) ctl.append(el('span', 'hp-hide', '+'))
  const node = el('span', `hp arg hero-k${pt.colour}${long ? ' long' : ''} wait`)
  node.append(el('span', 'hp-lab', pt.label ?? ''), ctl)
  if (pt.chips || pt.add) {
    const xtra = el('span', 'hp-xtra')
    for (const chip of pt.chips ?? []) {
      const c = el('span', 'hp-chip', `${chip.name} `, el('em', '', chip.value))
      if (chip.dropdown) c.append(chevron())
      xtra.append(c)
    }
    if (pt.add) xtra.append(el('span', 'hp-add', pt.add))
    node.append(xtra)
  }
  return node
}

async function foldRaw(raw: HTMLElement, wait: Clock['wait']) {
  const part = raw.closest<HTMLElement>('.hp')
  const v = raw.closest<HTMLElement>('.hv')
  if (!part || !v) return
  if (!find(v, '.hp-vt').textContent) {
    raw.style.transition = 'opacity 500ms'
    raw.style.opacity = '0'
    await wait(600)
    return
  }
  raw.style.display = 'none'
  const to = size(part)
  raw.style.display = ''
  glideBox(part, () => (v.style.whiteSpace = 'nowrap'), to)
  raw.style.transition = 'opacity 600ms 500ms'
  raw.style.opacity = '0'
  await wait(1150)
  raw.style.display = 'none'
  v.style.removeProperty('white-space')
  unpin(part)
}

// ── Layout ──────────────────────────────────────────────────────────────────

const ends = new WeakMap<HTMLElement, [number, number]>()

/**
 * Lay the command out in its final state (every part, final text, final classes), note
 * which line each part lands on, and fix those lines as rows. The typed size is then
 * fitted so the widest row fits on one line in the spaced, coloured state, and a tiled
 * command's tiles are shared out between its rows so none is left alone on the last.
 */
function layout(cmd: HTMLElement, h: HeroCommand, fast: boolean): HTMLElement[] {
  const parts = findAll(cmd, '.hp')
  const args = parts.filter((p) => p.classList.contains('arg'))
  const wrap = el('div', 'hero-row wrap')
  wrap.append(...parts)
  cmd.append(wrap)
  cmd.classList.add('measure', 'spaced')
  if (h.tiles) cmd.classList.add('tiles')
  h.parts.forEach((pt, j) => {
    const node = parts[j]
    if (!node) return
    node.classList.remove('wait')
    find(node, '.hp-vt').textContent =
      pt.kind === 'literal' ? pt.text : (pt.end ?? pt.value + (pt.append ?? ''))
    if (pt.kind === 'arg' && pt.raw !== undefined) find(node, '.hp-raw').textContent = pt.raw
  })
  for (const p of args) p.classList.add('hot')
  for (const e of findAll(cmd, '.hp-lab, .hp-xtra, .hp-hide')) {
    e.style.setProperty('--mw', `${e.scrollWidth}px`)
    e.style.setProperty('--mh', `${e.scrollHeight}px`)
  }
  const split = () => {
    const lines: HTMLElement[][] = []
    let bottom = -Infinity
    for (const node of parts) {
      const r = node.getBoundingClientRect()
      if (r.top >= bottom - 1) {
        lines.push([])
        bottom = r.bottom
      } else bottom = Math.max(bottom, r.bottom)
      lines[lines.length - 1]?.push(node)
    }
    cmd.textContent = ''
    for (const line of lines) {
      const row = el('div', 'hero-row')
      const late = line.every((p) => {
        const pt = h.parts[parts.indexOf(p)]
        return pt?.kind === 'arg' && pt.late === true
      })
      if (late) row.classList.add('late')
      row.append(...line)
      cmd.append(row)
    }
  }
  split()
  for (const node of parts) ends.set(node, size(node))
  cmd.classList.remove('tiles')
  cmd.style.removeProperty('--fs')
  const f0 = parseFloat(getComputedStyle(cmd).fontSize)
  const widest = Math.max(...findAll(cmd, '.hero-row').map((r) => r.scrollWidth))
  const floor = cmd.clientWidth > 520 ? 17 : 14
  const fitted = Math.max(floor, Math.min(f0, ((f0 * cmd.clientWidth) / widest) * 0.97))
  cmd.style.setProperty('--fs', `${fitted.toFixed(1)}px`)

  const rows = findAll(cmd, '.hero-row')
  if (h.tiles && rows.length > 1 && rows[0]) {
    const gap = parseFloat(getComputedStyle(rows[0]).columnGap) || 0
    const widths = parts.map((p) => ends.get(p)?.[0] ?? 0)
    const span = (a: number, b: number) =>
      widths.slice(a, b).reduce((t, v) => t + v, 0) + gap * (b - a - 1)
    const best = (a: number, k: number): { max: number; cuts: number[] } => {
      if (k === 1) return { max: span(a, parts.length), cuts: [] }
      let pick: { max: number; cuts: number[] } | null = null
      for (let c = a + 1; c <= parts.length - k + 1; c++) {
        const rest = best(c, k - 1)
        const max = Math.max(span(a, c), rest.max)
        if (!pick || max < pick.max) pick = { max, cuts: [c, ...rest.cuts] }
      }
      return pick ?? { max: span(a, parts.length), cuts: [] }
    }
    const stops = [...best(0, rows.length).cuts, parts.length]
    cmd.textContent = ''
    stops.forEach((stop, i) => {
      const row = el('div', 'hero-row')
      row.append(...parts.slice(i ? stops[i - 1] : 0, stop))
      cmd.append(row)
    })
  }
  // A smaller typed size fits more on a line, so lines without tiles are measured again.
  if (!h.tiles) {
    const again = el('div', 'hero-row wrap')
    again.append(...parts)
    cmd.textContent = ''
    cmd.append(again)
    split()
  }
  if (fast) return parts
  for (const node of parts) {
    node.classList.add('wait')
    node.classList.remove('hot')
    find(node, '.hp-vt').textContent = ''
    const raw = node.querySelector<HTMLElement>('.hp-raw')
    if (raw) raw.textContent = ''
  }
  cmd.classList.remove('spaced')
  void cmd.offsetWidth
  cmd.classList.remove('measure')
  return parts
}

// ── One command ─────────────────────────────────────────────────────────────

/** What one command plays on: its parts, its nodes, and what sits beside it. */
interface Stage {
  host: HTMLElement
  c: Clock
  h: HeroCommand
  v: HeroShape | null
  st: ShapeState
  cmd: HTMLElement
  parts: HeroPart[]
  nodes: HTMLElement[]
  viz: HTMLElement | null
  cv: HTMLCanvasElement | null
  cur: HTMLElement | null
  chain: HTMLElement | null
}

/** The right half: a `//generate` preview with its tools and cursor, or `/execute`'s steps. */
function vizFor(h: HeroCommand, v: HeroShape | null) {
  if (h.viz === 'chain') {
    const chain = el('div', 'hero-chain')
    return { viz: el('div', 'hero-viz', chain), cv: null, cur: null, chain }
  }
  if (h.viz !== 'shape' || !v) return { viz: null, cv: null, cur: null, chain: null }
  const cv = el('canvas')
  const cur = el('div', 'hero-cursor', cursorIcon())
  const viz = el('div', 'hero-viz', cv)
  if (v.object) {
    const add = el('span', 'on', 'Add')
    add.dataset.mode = 'add'
    const cut = el('span', '', 'Cut')
    cut.dataset.mode = 'cut'
    const obj = el('span', 'hero-obj', OBJECT_ICONS[v.object.name](), v.object.name)
    viz.append(el('div', 'hero-tools', obj, el('span', 'hero-mode', add, cut)))
  }
  viz.append(cur)
  return { viz, cv, cur, chain: null }
}

/** `//generate`'s two arguments, filled from the structure it builds this time. */
function partsFor(h: HeroCommand, v: HeroShape | null, st: ShapeState): HeroPart[] {
  return h.parts.map((pt) => {
    if (pt.kind !== 'arg' || !v) return pt
    if (pt.swatch === 'block') return { ...pt, value: v.block }
    if (pt.label !== 'Expression') return pt
    const end = v.object ? exprText(v, { ...st, obj: 2 }) : undefined
    return { ...pt, value: exprText(v, st), end }
  })
}

function stage(host: HTMLElement, h: HeroCommand, v: HeroShape | null, c: Clock): Stage {
  host.removeAttribute('data-out')
  if (h.viz) host.setAttribute('data-viz', '')
  else host.removeAttribute('data-viz')
  const cmd = el('div', 'hero-cmd')
  host.replaceChildren(cmd)
  const side = vizFor(h, v)
  if (side.viz) host.append(side.viz)
  const st: ShapeState = v ? { ...v.init } : {}
  const parts = partsFor(h, v, st)
  for (const pt of parts) {
    const swatch = pt.kind !== 'arg' ? undefined : pt.swatch === 'block' ? v?.colour : pt.swatch
    const node = partNode(pt, swatch)
    if (pt.kind === 'arg' && pt.label === 'Expression') node.dataset.param = 'expr'
    cmd.append(node)
  }
  const nodes = layout(cmd, { ...h, parts }, c.fast)
  return { host, c, h, v, st, cmd, parts, nodes, ...side }
}

function addStep(s: Stage, pt: HeroArg, n: number, value: string) {
  const chain = s.chain
  if (!chain) return
  const node = stepNode(n, pt, value)
  flipMove(findAll(chain, '.hero-step'), () => chain.append(node), s.c.fast)
  void node.offsetWidth
  node.classList.remove('slot')
}

/** Draw the structure and write its expression, as the preview first appears. */
function showShape(s: Stage) {
  if (!s.cv || !s.v) return
  renderExpr(find(s.host, '.hp[data-param="expr"] .hp-vt'), s.v, s.st, '')
  drawShape(s.cv, s.v, s.st, palette(s.host))
}

/** Reduced motion: the finished command, held. */
function settle(s: Stage) {
  s.cmd.classList.remove('measure')
  if (s.h.tiles) s.cmd.classList.add('tiles', 'rest')
  s.viz?.classList.add('in')
  showShape(s)
  let n = 0
  for (const pt of s.parts) {
    if (pt.kind === 'arg') addStep(s, pt, ++n, (pt.step?.value ?? '') + (pt.append ?? ''))
  }
}

/** 1. The command types itself, each part already on the row it ends on. */
async function typeOut(s: Stage) {
  const { c } = s
  const caret = el('span', 'hero-caret')
  const typeInto = async (target: HTMLElement, text: string, ms: number) => {
    const step = Math.max(1, Math.ceil(text.length / 14))
    for (let n = step; n < text.length + step; n += step) {
      target.textContent = text.slice(0, Math.min(n, text.length))
      target.append(caret)
      await c.wait(ms)
    }
  }
  await c.wait(450)
  for (const [j, pt] of s.parts.entries()) {
    const node = s.nodes[j]
    if (!node || (pt.kind === 'arg' && pt.late)) continue
    node.classList.remove('wait')
    const literal = pt.kind === 'literal'
    await typeInto(find(node, '.hp-vt'), literal ? pt.text : pt.value, literal ? 30 : 45)
    if (!literal && pt.raw !== undefined) await typeInto(find(node, '.hp-raw'), pt.raw, 40)
    await c.wait(literal ? 60 : 140)
  }
  await c.wait(1000)
  caret.remove()
}

/** 2. It spaces out, one coloured part at a time; `/execute`'s steps arrive with them. */
async function colourIn(s: Stage) {
  s.cmd.classList.add('spaced')
  s.viz?.classList.add('in')
  let n = 0
  for (const [j, pt] of s.parts.entries()) {
    const node = s.nodes[j]
    if (!node || pt.kind !== 'arg' || pt.late) continue
    node.classList.add('hot')
    if (s.chain) addStep(s, pt, ++n, pt.step?.value ?? '')
    await s.c.wait(s.chain ? 650 : 350)
  }
  await s.c.wait(1000)
}

/** 3. Each part grows into its tile; text the tile shows elsewhere folds away first. */
async function growTiles(s: Stage) {
  const { c, cmd } = s
  await Promise.all(findAll(cmd, '.hp-raw').map((r) => foldRaw(r, c.wait)))
  await c.wait(250)
  // Each box glides straight from its coloured size to its tile size.
  const args = s.nodes.filter((e) => e.classList.contains('arg') && !e.classList.contains('wait'))
  for (const e of args) glideBox(e, () => {}, ends.get(e))
  cmd.classList.add('tiles')
  await c.wait(1250)
  for (const e of args) unpin(e)
  // The reveal is over: let every revealed box take its own size from here, so one
  // measured before the web font arrived, or before a resize, never crops its content.
  cmd.classList.add('rest')
  await c.wait(450)
}

async function playCommand(host: HTMLElement, h: HeroCommand, v: HeroShape | null, c: Clock) {
  const s = stage(host, h, v, c)
  if (c.fast) return settle(s)
  await typeOut(s)
  showShape(s)
  await colourIn(s)
  if (h.tiles) await growTiles(s)
  if (s.cv && s.cur && v) {
    await playShape({ host, c, st: s.st, v, cv: s.cv, cur: s.cur, pal: palette(host) })
  }
  if (s.chain) await playChain(host, { ...h, parts: s.parts }, c)
  await c.wait(2600)
  host.setAttribute('data-out', '')
  await c.wait(500)
}

/** Play the loop into `host` until the returned function is called. */
export function startHero(
  host: HTMLElement,
  sequence: readonly HeroCommand[],
  shapes: readonly HeroShape[],
  reduced: boolean,
): () => void {
  const c = clock(reduced)
  let shapeIndex = -1
  const run = async () => {
    try {
      // Every size the loop measures is the web font's, so it waits for it.
      if ('fonts' in document) await document.fonts.ready
      for (let i = 0; ; i = (i + 1) % sequence.length) {
        const h = sequence[i]
        if (!h) return
        const v =
          h.viz === 'shape'
            ? (shapes[(shapeIndex = (shapeIndex + 1) % shapes.length)] ?? null)
            : null
        await playCommand(host, h, v, c)
        if (c.fast) return
      }
    } catch (e) {
      if (e !== ABORT) throw e
    }
  }
  void run()
  return () => {
    c.aborted = true
  }
}
