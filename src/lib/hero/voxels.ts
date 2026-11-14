/**
 * Voxels for the home page's `//generate` hero: a shape function sampled over a
 * selection, and a painter's-algorithm draw of the result on a 2D canvas.
 *
 * Deliberately not the editor's preview (src/previews/worldedit), which is three.js and
 * lazy: the home page is the first thing a visitor loads, and a few hundred cubes drawn
 * flat cost nothing to fetch. The shapes are the editor's expressions, so what the hero
 * draws is what `//generate` would build.
 */

import type { Vec3 } from '../../worldedit/csg/tree'

export type { Vec3 }
export type Rgb = readonly [number, number, number]
/** A shape over the selection, each axis normalised to -1..1 as `//generate` does. */
export type Field = (x: number, y: number, z: number) => boolean

export interface Voxel {
  p: Vec3
  c: Rgb
  /** Opacity below 1 draws a ghost: every face, through its neighbours. */
  a?: number
}

export interface View {
  yaw: number
  pitch: number
  /** Screen units per block. */
  s: number
  cx: number
  cy: number
}

/**
 * The cells of an `n`-block cube inside `f`, centred on x and z with y from 0.
 * `hollow` keeps only the shell, which is what a ghost needs to read as a volume.
 */
export function voxelise(f: Field, n: number, hollow = false): Vec3[] {
  const inside = (i: number, j: number, k: number) =>
    i >= 0 &&
    j >= 0 &&
    k >= 0 &&
    i < n &&
    j < n &&
    k < n &&
    f((2 * (i + 0.5)) / n - 1, (2 * (j + 0.5)) / n - 1, (2 * (k + 0.5)) / n - 1)
  const out: Vec3[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        if (!inside(i, j, k)) continue
        if (
          hollow &&
          inside(i + 1, j, k) &&
          inside(i - 1, j, k) &&
          inside(i, j + 1, k) &&
          inside(i, j - 1, k) &&
          inside(i, j, k + 1) &&
          inside(i, j, k - 1)
        ) {
          continue
        }
        out.push([i - (n - 1) / 2, j, k - (n - 1) / 2])
      }
    }
  }
  return out
}

/** The selection-space point (-1..1 on each axis) of an `n`-cube cell from `voxelise`. */
export function cellCentre(q: Vec3, n: number): Vec3 {
  return [
    (2 * (q[0] + (n - 1) / 2 + 0.5)) / n - 1,
    (2 * (q[1] + 0.5)) / n - 1,
    (2 * (q[2] + (n - 1) / 2 + 0.5)) / n - 1,
  ]
}

/** World to screen: yaw about y, then pitch the view down. */
export function projector({ yaw, pitch, s, cx, cy }: View) {
  const cyw = Math.cos(yaw)
  const syw = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return (x: number, y: number, z: number): [number, number] => {
    const xr = x * cyw - z * syw
    const zr = x * syw + z * cyw
    return [cx + xr * s, cy - (y * cp - zr * sp) * s]
  }
}

/** A colour scaled toward black by `m`, as a CSS colour. */
export function shade([r, g, b]: Rgb, m: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * m)))
  return `rgb(${c(r)},${c(g)},${c(b)})`
}

/** `#rrggbb` to channels. Throws on anything else, so a typo in the data is loud. */
export function hexRgb(hex: string): Rgb {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`not a six-digit hex colour: ${hex}`)
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

const FACES = [
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, 1],
    v: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    n: [0, 0, -1],
    v: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
] as const

/**
 * Draw blocks back to front. A face against a solid neighbour is skipped; a ghost's
 * face is skipped only against another ghost, so a ghost shows through solid blocks'
 * outline but never doubles up on itself.
 */
export function drawBlocks(g: CanvasRenderingContext2D, blocks: readonly Voxel[], view: View) {
  const key = (p: Vec3) => `${p[0]},${p[1]},${p[2]}`
  const solid = new Set(blocks.filter((b) => b.a === undefined || b.a >= 1).map((b) => key(b.p)))
  const all = new Set(blocks.map((b) => key(b.p)))
  const cyw = Math.cos(view.yaw)
  const syw = Math.sin(view.yaw)
  const cp = Math.cos(view.pitch)
  const sp = Math.sin(view.pitch)
  const rot = (x: number, y: number, z: number): Vec3 => [x * cyw - z * syw, y, x * syw + z * cyw]
  const project = projector(view)
  const faces = FACES.map((f) => {
    const r = rot(f.n[0], f.n[1], f.n[2])
    const light = f.n[1] > 0 ? 1 : f.n[1] < 0 ? 0.45 : 0.62 + 0.22 * Math.max(0, r[0])
    return { ...f, light, visible: r[1] * sp + r[2] * cp > 0.001 }
  }).filter((f) => f.visible)
  const depth = (p: Vec3) => {
    const r = rot(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5)
    return r[1] * sp + r[2] * cp
  }
  const list = [...blocks].sort((a, b) => depth(a.p) - depth(b.p))
  for (const b of list) {
    const [x, y, z] = b.p
    const ghost = b.a !== undefined && b.a < 1
    g.globalAlpha = b.a ?? 1
    for (const f of faces) {
      const nb: Vec3 = [x + f.n[0], y + f.n[1], z + f.n[2]]
      if (ghost ? all.has(key(nb)) : solid.has(key(nb))) continue
      g.beginPath()
      f.v.forEach((v, i) => {
        const q = project(x + v[0] - 0.5, y + v[1], z + v[2] - 0.5)
        if (i === 0) g.moveTo(q[0], q[1])
        else g.lineTo(q[0], q[1])
      })
      g.closePath()
      g.fillStyle = shade(b.c, f.light)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,.18)'
      g.lineWidth = 0.6
      g.stroke()
    }
  }
  g.globalAlpha = 1
}

/** Size a canvas's backing store to its box at up to 2x, and say what it came to. */
export function fitCanvas(cv: HTMLCanvasElement) {
  const d = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(cv.clientWidth * d))
  const h = Math.max(1, Math.round(cv.clientHeight * d))
  if (cv.width !== w || cv.height !== h) {
    cv.width = w
    cv.height = h
  }
  return { w, h, d }
}
