/**
 * The `//generate` scene: the structure drawn as voxels, its gizmos, and a cursor that
 * adds an object, cuts it, and drags each gizmo while the expression follows.
 */
import type { ExprPiece, Handle, HeroShape, ShapeState } from './types'
import {
  cellCentre,
  drawBlocks,
  fitCanvas,
  hexRgb,
  projector,
  voxelise,
  type Rgb,
  type Voxel,
} from './voxels'
import { type Clock, EASE, el, find, glideBox, unpin } from './dom'

export interface Palette {
  grid: string
  accent: Rgb
  accentCss: string
  sideCss: string
}

/** The canvas's colours, read from the token layer so a theme or accent change follows. */
export function palette(from: Element): Palette {
  const css = getComputedStyle(from)
  const rgb = (name: string): Rgb => {
    const parts = css.getPropertyValue(name).trim().split(/\s+/).map(Number)
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
  }
  const accent = rgb('--accent-rgb')
  return {
    grid: css.getPropertyValue('--border-subtle').trim(),
    accent,
    accentCss: `rgb(${accent.join(' ')})`,
    sideCss: css.getPropertyValue('--sun').trim(),
  }
}

const exprPieces = (v: HeroShape, st: ShapeState): readonly ExprPiece[] => v.expr(st)

/** The expression as text, folded parts as an ellipsis. */
export function exprText(v: HeroShape, st: ShapeState): string {
  return exprPieces(v, st)
    .map((t) => (typeof t === 'string' ? t : 'fold' in t ? '…' : (st[t.param] ?? 0).toFixed(2)))
    .join('')
}

/** The expression into `node`, the number being dragged lit. */
export function renderExpr(node: HTMLElement, v: HeroShape, st: ShapeState, hot: string) {
  node.textContent = ''
  for (const t of exprPieces(v, st)) {
    if (typeof t === 'string') node.append(t)
    else if ('fold' in t) node.append(el('span', 'hero-fold', '…'))
    else node.append(el('span', hot === t.param ? 'hero-hot' : '', (st[t.param] ?? 0).toFixed(2)))
  }
}

type HandlePoints = Partial<Record<Handle, [number, number]>>

/** Where the canvas's box (its parent) sits inside it, in backing-store pixels. */
function boxIn(cv: HTMLCanvasElement, d: number, w: number, h: number) {
  const box = cv.parentElement?.getBoundingClientRect()
  const r = cv.getBoundingClientRect()
  if (!box?.width || !r.width) return [0, 0, w, h] as const
  return [(box.left - r.left) * d, (box.top - r.top) * d, box.width * d, box.height * d] as const
}

/** How far the canvas starts before the box it bleeds out of, in CSS pixels. */
function bleed(cv: HTMLCanvasElement): [number, number] {
  const box = cv.parentElement?.getBoundingClientRect()
  const r = cv.getBoundingClientRect()
  return box ? [box.left - r.left, box.top - r.top] : [0, 0]
}

/** Draw the structure, its ground grid and its gizmos; return where the gizmos' tips are. */
export function drawShape(cv: HTMLCanvasElement, v: HeroShape, st: ShapeState, pal: Palette) {
  const { w, h, d } = fitCanvas(cv)
  const g = cv.getContext('2d')
  if (!g) return {}
  g.clearRect(0, 0, w, h)
  const N = v.n
  const k = N / 15
  // The canvas bleeds past its box so the ground grid can fade out over the next
  // section rather than at the box's edge; the structure is laid out in the box.
  const [bx, by, bw, bh] = boxIn(cv, d, w, h)
  const view = {
    yaw: v.yaw,
    pitch: 0.5,
    s: Math.min(bw / (21 * k), bh / (23 * k)),
    cx: bx + bw * 0.46,
    cy: by + bh * 0.78,
  }
  const P = projector(view)
  const G = Math.round(9 * k)
  g.strokeStyle = pal.grid
  g.lineWidth = d
  for (let i = -G; i <= G; i++) {
    for (const [a, b] of [
      [P(i, 0, -G), P(i, 0, G)],
      [P(-G, 0, i), P(G, 0, i)],
    ] as const) {
      g.beginPath()
      g.moveTo(a[0], a[1])
      g.lineTo(b[0], b[1])
      g.stroke()
    }
  }
  // The grid fades out toward its edges.
  const [ox, oy] = P(0, 0, 0)
  const rx = Math.min(ox, w - ox) * 0.96
  const ry = Math.min(rx * 0.5, (h - oy) * 0.94)
  g.save()
  g.globalCompositeOperation = 'destination-in'
  g.translate(ox, oy)
  g.scale(1, ry / rx)
  const fade = g.createRadialGradient(0, 0, 0, 0, 0, rx)
  fade.addColorStop(0, 'rgba(0,0,0,1)')
  fade.addColorStop(0.65, 'rgba(0,0,0,.75)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = fade
  g.fillRect(-rx, -rx, 2 * rx, 2 * rx)
  g.restore()

  const colour = hexRgb(v.colour)
  const solid: Voxel[] = voxelise(v.field(st), N).map((p) => ({ p, c: colour }))
  let ghost: Voxel[] = []
  if (v.object && st.obj === 2) {
    const base = v.object.base(st)
    ghost = voxelise(v.object.field(st), N, true)
      .filter((q) => base(...cellCentre(q, N)))
      .map((p) => ({ p, c: pal.accent, a: 0.16 }))
  }
  drawBlocks(g, [...solid, ...ghost], view)

  const V = ([x, y, z]: readonly [number, number, number]) =>
    [(x * N) / 2, ((y + 1) / 2) * N, (z * N) / 2] as const
  if (v.ring && v.handles.top) {
    const t = V(v.handles.top(st))[1]
    const r = ((st.R ?? 0) * N) / 2
    g.strokeStyle = `rgb(${pal.accent.join(' ')} / 0.45)`
    g.lineWidth = 1.5 * d
    g.beginPath()
    for (let i = 0; i <= 64; i++) {
      const q = P(r * Math.cos((i / 64) * Math.PI * 2), t, r * Math.sin((i / 64) * Math.PI * 2))
      if (i === 0) g.moveTo(q[0], q[1])
      else g.lineTo(q[0], q[1])
    }
    g.stroke()
  }
  const out: HandlePoints = {}
  const L = 3.4 * k
  const gizmos: [Handle, readonly [number, number, number], string][] = [
    ['top', [0, 1, 0], pal.accentCss],
    ['side', [1, 0, 0], pal.sideCss],
  ]
  for (const [name, dir, col] of gizmos) {
    const at = v.handles[name]
    if (!at || (v.object && (st.obj ?? 0) < 2)) continue
    const b = V(at(st))
    const a = P(b[0], b[1], b[2])
    const t = P(b[0] + dir[0] * L, b[1] + dir[1] * L, b[2] + dir[2] * L)
    g.strokeStyle = col
    g.lineWidth = 2.2 * d
    g.beginPath()
    g.moveTo(a[0], a[1])
    g.lineTo(t[0], t[1])
    g.stroke()
    g.fillStyle = col
    g.beginPath()
    g.arc(t[0], t[1], 6.5 * d, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(0,0,0,0.5)'
    g.lineWidth = d
    g.stroke()
    out[name] = [t[0] / d, t[1] / d]
  }
  return out
}

export interface Scene {
  host: HTMLElement
  c: Clock
  st: ShapeState
  v: HeroShape
  cv: HTMLCanvasElement
  cur: HTMLElement
  pal: Palette
}

/** The cursor adds an object and cuts it, if there is one, then drags each gizmo. */
export async function playShape(x: Scene) {
  const { v, st, cv, cur, c } = x
  const expr = find(x.host, '.hp[data-param="expr"] .hp-vt')
  // Points are the canvas's; the cursor sits in the box the canvas bleeds out of.
  // Both are measured at every move, so a scroll or a resize never leaves it aiming
  // where a button used to be.
  const place = (pt: readonly [number, number], ms: number) => {
    const [ox, oy] = bleed(cv)
    cur.style.transition = `opacity 300ms, transform ${ms}ms ${EASE}`
    cur.style.transform = `translate(${pt[0] - ox - 3}px, ${pt[1] - oy - 2}px)`
  }
  let hd = drawShape(cv, v, st, x.pal)
  const vb = cv.getBoundingClientRect()
  const first = v.drags[0]
  const start = (first && hd[first[2]]) ?? [vb.width * 0.5, vb.height * 0.55]
  place([start[0] + 120, start[1] + 160], 0)
  await c.wait(50)
  cur.classList.add('on')
  const click = async () => {
    cur.classList.add('down')
    await c.wait(180)
    cur.classList.remove('down')
  }
  if (v.object) {
    // The object's button arrives top right; click it, then switch it from Add to Cut.
    const tools = find(x.host, '.hero-tools')
    const obj = find(tools, '.hero-obj')
    const part = expr.closest<HTMLElement>('.hp')
    const setExpr = async () => {
      if (part) glideBox(part, () => renderExpr(expr, v, st, ''))
      await c.wait(1150)
      if (part) unpin(part)
    }
    const at = (e: HTMLElement): [number, number] => {
      const r = e.getBoundingClientRect()
      const o = cv.getBoundingClientRect()
      return [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2]
    }
    tools.classList.add('in')
    await c.wait(800)
    place(at(obj), 950)
    await c.wait(1000)
    obj.classList.add('on')
    await click()
    st.obj = 1
    tools.classList.add('picked')
    drawShape(cv, v, st, x.pal)
    await setExpr()
    const cut = find(tools, '[data-mode="cut"]')
    place(at(cut), 800)
    await c.wait(850)
    await click()
    find(tools, '[data-mode="add"]').classList.remove('on')
    cut.classList.add('on')
    st.obj = 2
    hd = drawShape(cv, v, st, x.pal)
    await setExpr()
  }
  for (const [key, to, which] of v.drags) {
    const from = hd[which]
    if (!from) continue
    place(from, 950)
    await c.wait(1000)
    cur.classList.add('down')
    await c.wait(200)
    const origin = st[key] ?? 0
    const steps = 44
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      st[key] = origin + (to - origin) * e
      hd = drawShape(cv, v, st, x.pal)
      const tip = hd[which]
      if (tip) place(tip, 0)
      renderExpr(expr, v, st, key)
      await c.wait(42)
    }
    cur.classList.remove('down')
    await c.wait(400)
    renderExpr(expr, v, st, '')
    await c.wait(300)
  }
  const rest = hd.side ?? hd.top
  if (rest) place([rest[0] + 70, rest[1] + 90], 950)
  await c.wait(1000)
  cur.classList.remove('on')
}
