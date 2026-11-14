import type {
  ArgColour,
  ExprPiece,
  Handle,
  HeroArg,
  HeroCommand,
  HeroShape,
  ShapeState,
} from '../../lib/hero/types'

/*
 * The home page's hero: the commands it types and the structures it builds, in the
 * order docs/home-page.md fixes. Game values, so they live here rather than in a
 * component: every id below is checked against Java Edition 1.21.1, and the colours are
 * the preview's stand-in for each block's texture, not the game's.
 */

const hypot = Math.hypot

const drags = (...each: [string, number, Handle][]): HeroShape['drags'] => each

/** An argument picked from a list, typed into a field, or stepped. */
const pick = (
  colour: ArgColour,
  label: string,
  value: string,
  more?: Partial<HeroArg>,
): HeroArg => ({
  kind: 'arg',
  colour,
  label,
  value,
  dropdown: true,
  ...more,
})
const field = (
  colour: ArgColour,
  label: string,
  value: string,
  more?: Partial<HeroArg>,
): HeroArg => ({ kind: 'arg', colour, label, value, ...more })
const step = (colour: ArgColour, label: string, value: string): HeroArg => ({
  kind: 'arg',
  colour,
  label,
  value,
  stepper: true,
})
/** A step of `/execute`: typed as `keyword value`, shown as a tile beside the command. */
const link = (
  colour: ArgColour,
  keyword: string,
  value: string,
  more?: Partial<HeroArg>,
): HeroArg => ({
  kind: 'arg',
  colour,
  value: `${keyword} ${value}`,
  step: { keyword, value, run: keyword === 'run' },
  ...more,
})
const literal = (text: string) => ({ kind: 'literal', text }) as const

/** Resize-and-drag structures. */
const RESIZE: HeroShape[] = [
  {
    block: 'stone_bricks',
    colour: '#8f8b86',
    n: 15,
    yaw: 0.62,
    ring: true,
    init: { R: 0.4, H: 0.1 },
    field: (s) => (x, y, z) => hypot(x, z) < s.R && y < s.H,
    expr: () => ['sqrt(x^2+z^2)<', { param: 'R' }, '&&y<', { param: 'H' }],
    handles: { top: (s) => [0, s.H, 0], side: (s) => [s.R, (s.H - 1) / 2, 0] },
    drags: drags(['H', 0.8, 'top'], ['R', 0.62, 'side']),
  },
  {
    block: 'copper_block',
    colour: '#c0714d',
    n: 17,
    yaw: 0.62,
    init: { R: 0.45, T: 0.15 },
    field: (s) => (x, y, z) => (s.R - hypot(x, z)) ** 2 + y * y < s.T * s.T,
    expr: () => ['(', { param: 'R' }, '-sqrt(x^2+z^2))^2+y^2<', { param: 'T' }, '^2'],
    handles: { top: (s) => [s.R, s.T, 0], side: (s) => [s.R + s.T, 0, 0] },
    drags: drags(['R', 0.64, 'side'], ['T', 0.3, 'top']),
  },
  {
    block: 'red_terracotta',
    colour: '#9b4b3b',
    n: 17,
    yaw: 0.32,
    init: { K: 1.25, S: 0.3 },
    field: (s) => (x, y, z) =>
      (z * 1.5) ** 2 + x * x + (s.K * y + 0.25 - Math.sqrt(Math.abs(x))) ** 2 < s.S,
    expr: () => [
      { fold: '(z*1.5)^2+x^2' },
      '+(',
      { param: 'K' },
      '*y+0.25-sqrt(abs(x)))^2<',
      { param: 'S' },
    ],
    handles: {
      top: (s) => {
        let m = -1
        for (let i = 0; i <= 40; i++) {
          const x = (Math.sqrt(s.S) * i) / 40
          m = Math.max(m, Math.sqrt(x) + Math.sqrt(Math.max(0, s.S - x * x)))
        }
        return [0, Math.min(1, (m - 0.25) / s.K), 0]
      },
      side: (s) => [Math.sqrt(s.S), (Math.sqrt(Math.sqrt(s.S)) - 0.25) / s.K, 0],
    },
    drags: drags(['S', 0.48, 'side'], ['K', 1.0, 'top']),
  },
  {
    block: 'smooth_sandstone',
    colour: '#d3c08c',
    n: 19,
    yaw: 0.9,
    init: { R: 0.55, H: 0.6 },
    field: (s) => (x, y, z) => {
      const r = Math.sqrt((x * x + z * z) / (s.R * s.R) + (y + 1) ** 2 / (s.H * s.H))
      return r < 1 && r > 0.76 && !(Math.abs(z) < 0.2 && y < -1 + 0.62 * s.H)
    },
    expr: () => [
      'r=sqrt((x^2+z^2)/',
      { param: 'R' },
      '^2+(y+1)^2/',
      { param: 'H' },
      '^2);',
      { fold: 'r<1&&r>0.76&&!(abs(z)<0.2&&y<-1+0.62*h)' },
    ],
    handles: { top: (s) => [0, -1 + s.H, 0], side: (s) => [s.R * 0.94, -1 + 0.35 * s.H, 0] },
    drags: drags(['R', 0.85, 'side'], ['H', 1.3, 'top']),
  },
  {
    block: 'quartz_block',
    colour: '#e4ded3',
    n: 19,
    yaw: 0.62,
    init: { R: 0.32, H: 0.1 },
    field: (s) => (x, y, z) => {
      const c = Math.cos(y * 1.2)
      const n = Math.sin(y * 1.2)
      return Math.abs(x * c - z * n) < s.R && Math.abs(x * n + z * c) < s.R && y < s.H
    },
    expr: () => [
      'abs(x*cos(y*1.2)-z*sin(y*1.2))<',
      { param: 'R' },
      '&&',
      { fold: 'abs(x*sin(y*1.2)+z*cos(y*1.2))<r' },
      '&&y<',
      { param: 'H' },
    ],
    handles: { top: (s) => [0, s.H, 0], side: (s) => [s.R * 1.25, (s.H - 1) / 2, 0] },
    drags: drags(['H', 0.85, 'top'], ['R', 0.5, 'side']),
  },
]

/** The expression of a structure with an object: alone, added to it, or cut from it. */
function withObject(base: string, object: readonly ExprPiece[]): HeroShape['expr'] {
  return (s: ShapeState) =>
    s.obj === 0
      ? [base]
      : s.obj === 1
        ? [{ fold: base }, '||', ...object]
        : [{ fold: base }, '&&!(', ...object, ')']
}

/** A field with its object applied the way `state.obj` says. */
function combined(base: HeroShape['field'], object: HeroShape['field']): HeroShape['field'] {
  return (s) => {
    const b = base(s)
    const o = object(s)
    if (s.obj === 0) return b
    if (s.obj === 1) return (x, y, z) => b(x, y, z) || o(x, y, z)
    return (x, y, z) => b(x, y, z) && !o(x, y, z)
  }
}

const sphereBase: HeroShape['field'] = () => (x, y, z) =>
  Math.abs(x) < 0.7 && Math.abs(z) < 0.7 && y < 0.2
const sphere: HeroShape['field'] = (s) => (x, y, z) => x * x + (y - s.Y) ** 2 + z * z < s.C * s.C
const domeBase: HeroShape['field'] = () => (x, y, z) => x * x + (y + 1) ** 2 + z * z < 0.81
const tunnel: HeroShape['field'] = (s) => (_x, y, z) => (y + 1) ** 2 + z * z < s.r * s.r
const towerBase: HeroShape['field'] = () => (x, y, z) => hypot(x, z) < 0.6 && y < 0.8
const slot: HeroShape['field'] = (s) => (_x, y, z) => Math.abs(y - s.Y) < 0.18 && Math.abs(z) < 0.3

/** Add-then-cut structures. */
const CUT: HeroShape[] = [
  {
    block: 'deepslate_tiles',
    colour: '#575760',
    n: 17,
    yaw: 0.62,
    init: { Y: 0.45, C: 0.55, obj: 0 },
    field: combined(sphereBase, sphere),
    object: { name: 'Sphere', base: sphereBase, field: sphere },
    expr: withObject('abs(x)<0.7&&abs(z)<0.7&&y<0.2', [
      'x^2+(y-',
      { param: 'Y' },
      ')^2+z^2<',
      { param: 'C' },
      '^2',
    ]),
    handles: { top: (s) => [0, s.Y + s.C, 0] },
    drags: drags(['Y', 0.05, 'top']),
  },
  {
    block: 'mud_bricks',
    colour: '#8d6c50',
    n: 19,
    yaw: 0.95,
    init: { r: 0.22, obj: 0 },
    field: combined(domeBase, tunnel),
    object: { name: 'Cylinder', base: domeBase, field: tunnel },
    expr: withObject('x^2+(y+1)^2+z^2<0.9^2', ['(y+1)^2+z^2<', { param: 'r' }, '^2']),
    handles: { top: (s) => [0.92, -1 + s.r, 0] },
    drags: drags(['r', 0.52, 'top']),
  },
  {
    block: 'end_stone_bricks',
    colour: '#d8d3a2',
    n: 19,
    yaw: 0.5,
    init: { Y: 0.55, obj: 0 },
    field: combined(towerBase, slot),
    object: { name: 'Box', base: towerBase, field: slot },
    expr: withObject('sqrt(x^2+z^2)<0.6&&y<0.8', ['abs(y-', { param: 'Y' }, ')<0.18&&abs(z)<0.3']),
    handles: { top: (s) => [0.62, s.Y + 0.18, 0] },
    drags: drags(['Y', 0.05, 'top']),
  },
]

/** Resize and cut-away structures take turns. */
export const HERO_SHAPES: readonly HeroShape[] = RESIZE.flatMap((v, i) => {
  const cut = CUT[i]
  return cut ? [v, cut] : [v]
})

const give: HeroCommand = {
  tiles: true,
  parts: [
    literal('/give'),
    pick(1, 'Recipients', '@p'),
    pick(2, 'Item stack', 'diamond_sword', {
      raw: '[enchantments={levels:{sharpness:5}}]',
      chips: [{ name: 'enchantments', value: 'sharpness 5' }],
      add: '+ Add component',
    }),
    step(4, 'Count', '1'),
  ],
}

const generate: HeroCommand = {
  tiles: true,
  viz: 'shape',
  parts: [
    literal('//generate'),
    { kind: 'arg', colour: 1, label: 'Blocks', value: '', swatch: 'block' },
    field(2, 'Expression', ''),
  ],
}

const execute: HeroCommand = {
  tiles: false,
  viz: 'chain',
  parts: [
    literal('/execute'),
    link(1, 'as', '@a', { append: '[team=red]' }),
    link(2, 'at', '@s'),
    link(3, 'if', 'block ~ ~-1 ~ magma_block'),
    link(1, 'unless', 'entity @s[gamemode=creative]', { late: true }),
    link(4, 'run', 'effect give @s fire_resistance 5'),
  ],
}

const effect: HeroCommand = {
  tiles: true,
  parts: [
    literal('/effect give'),
    pick(1, 'Targets', '@a'),
    // The swatch is the effect's particle colour in 1.21.1 (MobEffects.SPEED, 0x33ebff).
    pick(2, 'Effect', 'speed', { swatch: '#33ebff' }),
    step(3, 'Seconds', '30'),
    step(4, 'Amplifier', '1'),
    pick(1, 'Hide particles', 'true'),
  ],
}

const playsound: HeroCommand = {
  tiles: true,
  parts: [
    literal('/playsound'),
    pick(1, 'Sound', 'block.note_block.bell'),
    pick(2, 'Source', 'master'),
    pick(3, 'Targets', '@a'),
    field(4, 'Position', '~ ~ ~'),
    step(1, 'Volume', '1'),
    step(2, 'Pitch', '2'),
    step(3, 'Min volume', '0.5'),
  ],
}

// `/data`'s NBT as a list of tags, and a selector's filters as dropdowns under it, are
// how the editor should have them; it does not yet (docs/home-page.md).
const data: HeroCommand = {
  tiles: true,
  parts: [
    literal('/data merge'),
    pick(1, 'Target type', 'entity'),
    field(2, 'Target', '@n', {
      raw: '[type=zombie]',
      chips: [{ name: 'type', value: 'zombie', dropdown: true }],
    }),
    {
      kind: 'arg',
      colour: 3,
      label: 'NBT',
      value: '',
      raw: '{NoAI:1b,Silent:1b}',
      chipsOnly: true,
      chips: [
        { name: 'NoAI', value: 'true', dropdown: true },
        { name: 'Silent', value: 'true', dropdown: true },
      ],
      add: '+ Add tag',
    },
  ],
}

const particle: HeroCommand = {
  tiles: true,
  parts: [
    literal('/particle'),
    pick(1, 'Particle', 'flame'),
    field(2, 'Position', '~ ~1 ~'),
    field(3, 'Delta', '0.3 0.5 0.3'),
    step(4, 'Speed', '0.02'),
    step(1, 'Count', '40'),
    pick(2, 'Mode', 'force'),
    pick(3, 'Viewers', '@a'),
  ],
}

/** The loop, in play order: `//generate` comes round every third or fourth command. */
export const HERO_SEQUENCE: readonly HeroCommand[] = [
  give,
  effect,
  generate,
  execute,
  playsound,
  generate,
  data,
  particle,
  generate,
]
