import type {
  ArgColour,
  ExprPiece,
  Handle,
  HeroArg,
  HeroChip,
  HeroCommand,
  HeroPart,
  HeroShape,
  HeroSlot,
  ShapeState,
} from '../../lib/hero/types'
import { BLOCK_COLOURS } from '../authored/block-colours'

/*
 * The home page's hero: the commands it types and the structures it builds, in the
 * order docs/home-page.md fixes. Game values, so they live here rather than in a
 * component: every id below is checked against Java Edition 1.21.1, and the colours are
 * the preview's stand-in for each block's texture, not the game's.
 */

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

/** A number as a command writes it, the way the expression tile shows a dragged one. */
const f2 = (n: number | undefined) => (n ?? 0).toFixed(2)
const abs = Math.abs
const colour = (block: string) => BLOCK_COLOURS[block] ?? '#888888'

/** Resize-and-drag structures. */
const RESIZE: HeroShape[] = [
  {
    // A pagoda: stacked eaves, each tier narrower than the one below. Dragging the
    // tier count down the first eave adds roofs; the side gizmo widens the base.
    block: 'cherry_planks',
    colour: colour('cherry_planks'),
    n: 19,
    yaw: 0.62,
    init: { T: 2, W: 0.6 },
    field: (s) => (x, y, z) => {
      const t = (y + 1) / 2
      return Math.max(abs(x), abs(z)) < s.W * (1 - 0.45 * t) * (1 - 0.6 * ((t * s.T) % 1))
    },
    expr: () => [
      { fold: 't=(y+1)/2;max(abs(x),abs(z))' },
      '<',
      { param: 'W' },
      '*(1-0.45*t)*(1-0.6*(t*',
      { param: 'T' },
      '%1))',
    ],
    handles: {
      top: (s) => [0, -1 + 2 / s.T, 0],
      side: (s) => [s.W, -0.9, 0],
    },
    drags: drags(['T', 4, 'top'], ['W', 0.92, 'side']),
  },
  {
    block: 'red_terracotta',
    colour: '#9b4b3b',
    n: 17,
    yaw: 0.32,
    init: { K: 1.25, S: 0.3 },
    field: (s) => (x, y, z) =>
      (z * 1.5) ** 2 + x * x + (s.K * y + 0.25 - Math.sqrt(abs(x))) ** 2 < s.S,
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
    // A double helix: two strands a turn apart, joined by rungs. The top gizmo winds
    // it tighter, the side one pulls the strands apart.
    block: 'prismarine',
    colour: colour('prismarine'),
    n: 23,
    yaw: 0.62,
    init: { K: 2, R: 0.45 },
    field: (s) => (x, y, z) => {
      const c = Math.cos(s.K * y)
      const n = Math.sin(s.K * y)
      return (
        (x - s.R * c) ** 2 + (z - s.R * n) ** 2 < 0.03 ||
        (x + s.R * c) ** 2 + (z + s.R * n) ** 2 < 0.03 ||
        (abs(x * n - z * c) < 0.07 && x * x + z * z < s.R * s.R && Math.cos(y * 14) > 0.6)
      )
    },
    expr: (s) => [
      'a=',
      { param: 'K' },
      '*y;',
      { fold: 'c=cos(a);s=sin(a);' },
      '(x-',
      { param: 'R' },
      '*c)^2+',
      {
        fold: `(z-${f2(s.R)}*s)^2<0.03||(x+${f2(s.R)}*c)^2+(z+${f2(s.R)}*s)^2<0.03||abs(x*s-z*c)<0.07&&x^2+z^2<${f2(s.R)}^2&&cos(y*14)>0.6`,
      },
    ],
    handles: {
      top: (s) => [s.R * Math.cos(s.K * 0.85), 0.85, s.R * Math.sin(s.K * 0.85)],
      side: (s) => [s.R + 0.18, 0, 0],
    },
    drags: drags(['K', 3.6, 'top'], ['R', 0.62, 'side']),
  },
]

/**
 * The expression of a structure with an object: alone, added to it, or cut from it.
 * `pre` is the statements before the shape, and the shape is `shown` followed by
 * `rest`. Alone, only `shown` is visible and the rest folds, so a long structure types
 * no more than the expression it ends on (the layout reserves the end, so anything
 * longer would spill and then snap back). A shape that is an "or" of parts is bracketed
 * before an object is cut from it, because `&&` binds tighter than `||`.
 */
function withObject(
  pre: string,
  shown: string,
  rest: string,
  object: (s: ShapeState) => readonly ExprPiece[],
): HeroShape['expr'] {
  const base = shown + rest
  const cutFrom = base.includes('||') ? `(${base})` : base
  const alone: ExprPiece[] = [
    ...(pre ? [{ fold: pre }] : []),
    shown,
    ...(rest ? [{ fold: rest }] : []),
  ]
  return (s: ShapeState) =>
    s.obj === 0
      ? alone
      : s.obj === 1
        ? [{ fold: pre + base }, '||', ...object(s)]
        : [{ fold: pre + cutFrom }, '&&!(', ...object(s), ')']
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

/** A drum ringed with two storeys of arches, cut open into an arena. */
const drum: HeroShape['field'] = () => (x, y, z) =>
  Math.hypot(x, z) < 0.9 &&
  y < 0.1 &&
  !(abs(Math.sin(Math.atan2(z, x) * 5)) < 0.5 && (y + 1) % 0.55 < 0.38)
const arena: HeroShape['field'] = (s) => (x, y, z) => x * x + z * z < s.R * s.R && y > -0.85

/** A keep with battlements and four round turrets under conical roofs. */
const keep: HeroShape['field'] = () => (x, y, z) => {
  const d = (abs(x) - 0.55) ** 2 + (abs(z) - 0.55) ** 2
  const m = Math.max(abs(x), abs(z))
  return (
    (m < 0.55 && y < 0.15) ||
    (m > 0.43 && m < 0.55 && y < 0.3 && Math.sin((x + z) * 20) > 0) ||
    (d < 0.0625 && y < 0.45) ||
    (y > 0.4 && Math.sqrt(d) < 0.65 * (0.85 - y))
  )
}
const gate: HeroShape['field'] = (s) => (x, y) => abs(x) < 0.16 && y < s.G

/** A bridge between two towers, its arch cut from below. */
const span: HeroShape['field'] = () => (x, y, z) =>
  abs(z) < 0.28 && (y < -0.3 || (abs(abs(x) - 0.72) < 0.16 && y < 0.35))
const arch: HeroShape['field'] = (s) => (x, y) => x * x + (y + 1.15) ** 2 < s.R * s.R

/** Add-then-cut structures. */
const CUT: HeroShape[] = [
  {
    block: 'cut_sandstone',
    colour: colour('cut_sandstone'),
    n: 21,
    yaw: 0.62,
    init: { R: 0.3, obj: 0 },
    field: combined(drum, arena),
    object: { name: 'Cylinder', base: drum, field: arena },
    expr: withObject(
      'r=sqrt(x^2+z^2);',
      'r<0.9&&y<0.1&&',
      '!(abs(sin(atan2(z,x)*5))<0.5&&(y+1)%0.55<0.38)',
      () => ['x^2+z^2<', { param: 'R' }, '^2&&y>-0.85'],
    ),
    handles: { side: (s) => [s.R, 0.1, 0] },
    drags: drags(['R', 0.66, 'side']),
  },
  {
    block: 'stone_bricks',
    colour: colour('stone_bricks'),
    n: 19,
    yaw: 0.62,
    init: { G: -0.8, obj: 0 },
    field: combined(keep, gate),
    object: { name: 'Box', base: keep, field: gate },
    expr: withObject(
      'd=(abs(x)-0.55)^2+(abs(z)-0.55)^2;m=max(abs(x),abs(z));',
      'm<0.55&&y<0.15||',
      'm>0.43&&m<0.55&&y<0.3&&sin((x+z)*20)>0||d<0.0625&&y<0.45||y>0.4&&sqrt(d)<0.65*(0.85-y)',
      () => ['abs(x)<0.16&&y<', { param: 'G' }],
    ),
    handles: { top: (s) => [0, s.G, 0.6] },
    drags: drags(['G', -0.35, 'top']),
  },
  {
    block: 'mossy_stone_bricks',
    colour: colour('mossy_stone_bricks'),
    n: 19,
    yaw: 0.5,
    init: { R: 0.45, obj: 0 },
    field: combined(span, arch),
    object: { name: 'Cylinder', base: span, field: arch },
    expr: withObject('', 'abs(z)<0.28&&(y<-0.3||', 'abs(abs(x)-0.72)<0.16&&y<0.35)', () => [
      'x^2+(y+1.15)^2<',
      { param: 'R' },
      '^2',
    ]),
    handles: { top: (s) => [0, -1.15 + s.R, 0.3] },
    drags: drags(['R', 0.78, 'top']),
  },
]

/** Resize and cut-away structures take turns. */
export const HERO_SHAPES: readonly HeroShape[] = RESIZE.flatMap((v, i) => {
  const cut = CUT[i]
  return cut ? [v, cut] : [v]
})

/** A command that grows into tiles. */
const tiles = (...parts: HeroPart[]): HeroCommand => ({ tiles: true, parts })
/** An `/execute` chain, its steps laid out beside it. */
const chain = (...steps: HeroArg[]): HeroCommand => ({
  tiles: false,
  viz: 'chain',
  parts: [literal('/execute'), ...steps],
})

/** `/give`: recipients, an item stack with its components as chips, and a count. */
const give = (to: HeroArg, item: string, raw: string, chips: HeroChip[], count = '1') =>
  tiles(
    literal('/give'),
    to,
    pick(2, 'Item stack', item, { raw, chips, add: '+ Add component' }),
    step(4, 'Count', count),
  )

// Item components in 1.21.1's shape: `enchantments` keeps its `levels` wrapper and a
// `custom_name` is a JSON string (docs/minecraft-versions.md, both changed in 1.21.5).
const GIVE: HeroSlot = [
  give(pick(1, 'Recipients', '@p'), 'diamond_sword', '[enchantments={levels:{sharpness:5}}]', [
    { name: 'enchantments', value: 'sharpness 5' },
  ]),
  give(
    field(1, 'Recipients', '@a', {
      raw: '[team=blue]',
      chips: [{ name: 'team', value: 'blue', dropdown: true }],
    }),
    'bow',
    '[enchantments={levels:{power:5,flame:1}},unbreakable={}]',
    [
      { name: 'enchantments', value: 'power 5, flame 1' },
      { name: 'unbreakable', value: 'true' },
    ],
  ),
  give(
    field(1, 'Recipients', 'Snadrochka'),
    'potion',
    '[potion_contents={potion:"minecraft:strong_swiftness"}]',
    [{ name: 'potion_contents', value: 'strong_swiftness', dropdown: true }],
    '3',
  ),
  give(
    pick(1, 'Recipients', '@p'),
    'trident',
    `[custom_name='"Stormcaller"',enchantments={levels:{loyalty:3,channeling:1}}]`,
    [
      { name: 'custom_name', value: 'Stormcaller' },
      { name: 'enchantments', value: 'loyalty 3, channeling 1' },
    ],
  ),
]

const GENERATE: HeroSlot = [
  {
    tiles: true,
    viz: 'shape',
    parts: [
      literal('//generate'),
      { kind: 'arg', colour: 1, label: 'Blocks', value: '', swatch: 'block' },
      field(2, 'Expression', ''),
    ],
  },
]

const EXECUTE: HeroSlot = [
  chain(
    link(1, 'as', '@a', { append: '[team=red]' }),
    link(2, 'at', '@s'),
    link(3, 'if', 'block ~ ~-1 ~ magma_block'),
    link(1, 'unless', 'entity @s[gamemode=creative]', { late: true }),
    link(4, 'run', 'effect give @s fire_resistance 5'),
  ),
  chain(
    link(1, 'as', '@a', { append: '[tag=builder]' }),
    link(2, 'store', 'result score @s height'),
    link(3, 'if', 'dimension minecraft:overworld', { late: true }),
    link(4, 'run', 'data get entity @s Pos[1]'),
  ),
  chain(
    link(1, 'as', '@a', { append: '[gamemode=survival]' }),
    link(2, 'at', '@s'),
    link(3, 'if', 'items entity @s weapon.mainhand torch'),
    link(1, 'positioned', 'over motion_blocking_no_leaves', { late: true }),
    link(4, 'run', 'setblock ~ ~ ~ torch'),
  ),
]

const EFFECT: HeroSlot = [
  tiles(
    literal('/effect give'),
    pick(1, 'Targets', '@a'),
    // The swatch is the effect's particle colour in 1.21.1 (MobEffects.SPEED, 0x33ebff).
    pick(2, 'Effect', 'speed', { swatch: '#33ebff' }),
    step(3, 'Seconds', '30'),
    step(4, 'Amplifier', '1'),
    pick(1, 'Hide particles', 'true'),
  ),
]

const PLAYSOUND: HeroSlot = [
  tiles(
    literal('/playsound'),
    pick(1, 'Sound', 'block.note_block.bell'),
    pick(2, 'Source', 'master'),
    pick(3, 'Targets', '@a'),
    field(4, 'Position', '~ ~ ~'),
    step(1, 'Volume', '1'),
    step(2, 'Pitch', '2'),
    step(3, 'Min volume', '0.5'),
  ),
]

/** An NBT compound shown as its tags, one dropdown each. */
const nbt = (colour: ArgColour, label: string, raw: string, tags: [string, string][]): HeroArg => ({
  kind: 'arg',
  colour,
  label,
  value: '',
  raw,
  chipsOnly: true,
  chips: tags.map(([name, value]) => ({ name, value, dropdown: true })),
  add: '+ Add tag',
})

// `/data`'s NBT as a list of tags, and a selector's filters as dropdowns under it, are
// how the editor should have them; it does not yet (docs/home-page.md). Container items
// are 1.21.1's: `count` in lower case, as items have been written since 1.20.5.
const DATA: HeroSlot = [
  tiles(
    literal('/data merge'),
    pick(1, 'Target type', 'entity'),
    field(2, 'Target', '@n', {
      raw: '[type=zombie]',
      chips: [{ name: 'type', value: 'zombie', dropdown: true }],
    }),
    nbt(3, 'NBT', '{NoAI:1b,Silent:1b}', [
      ['NoAI', 'true'],
      ['Silent', 'true'],
    ]),
  ),
  tiles(
    literal('/data modify'),
    pick(1, 'Target type', 'block'),
    field(2, 'Position', '~ ~-1 ~'),
    field(3, 'Path', 'Items'),
    pick(4, 'Mode', 'append'),
    pick(1, 'Source', 'value'),
    nbt(2, 'Value', '{Slot:4b,id:"minecraft:diamond",count:3}', [
      ['Slot', '4'],
      ['id', 'diamond'],
      ['count', '3'],
    ]),
  ),
  tiles(
    literal('/data modify'),
    pick(1, 'Target type', 'storage'),
    field(2, 'Target', 'kommands:shop'),
    field(3, 'Path', 'stock'),
    pick(4, 'Mode', 'append'),
    pick(1, 'Source', 'from'),
    pick(2, 'Source type', 'entity'),
    field(3, 'Entity', 'crocodealer420'),
    field(4, 'Source path', 'SelectedItem'),
  ),
]

const PARTICLE: HeroSlot = [
  tiles(
    literal('/particle'),
    pick(1, 'Particle', 'flame'),
    field(2, 'Position', '~ ~1 ~'),
    field(3, 'Delta', '0.3 0.5 0.3'),
    step(4, 'Speed', '0.02'),
    step(1, 'Count', '40'),
    pick(2, 'Mode', 'force'),
    pick(3, 'Viewers', '@a'),
  ),
]

/** A mask as the Palette Editor shows it: its include, exclude and chance as chips. */
const mask = (raw: string, chips: HeroChip[]): HeroArg => ({
  kind: 'arg',
  colour: 2,
  label: 'Blocks to touch',
  value: '',
  raw,
  chipsOnly: true,
  chips,
  add: '+ rule',
})
/** A pattern as its blocks, each with its relative chance: typed `3%stone,1%dirt`. */
const place = (colour: ArgColour, ...blocks: [number, string][]): HeroArg => ({
  kind: 'arg',
  colour,
  label: 'Place',
  value: '',
  raw: blocks.map(([weight, block]) => `${weight}%${block}`).join(','),
  chipsOnly: true,
  chips: blocks.map(([weight, block]) => ({ name: block, value: String(weight) })),
  add: '+ block',
})

// The Palette Editor (src/data/authored/commands/worldedit/palette.ts): one sheet for
// the WorldEdit commands that take a mask, a pattern or both, the command picked in its
// first tile. Every line is what its serializers write for WorldEdit 7.3.6; hero.test.ts
// holds them to it. `//set` takes no mask.
const PALETTE: HeroSlot = [
  tiles(
    pick(1, 'Command', '//replace'),
    mask('"stone,andesite %40"', [
      { name: 'include', value: 'stone, andesite' },
      { name: 'chance', value: '40%' },
    ]),
    place(3, [3, 'cobblestone'], [2, 'mossy_cobblestone'], [1, 'gravel']),
  ),
  tiles(
    pick(1, 'Command', '/brush'),
    pick(2, 'Brush', 'sphere'),
    field(3, 'Hollow', '-h'),
    place(4, [3, 'glass'], [1, 'tinted_glass']),
    step(1, 'Radius', '6'),
  ),
  tiles(
    pick(1, 'Command', '//set'),
    place(2, [4, 'stone_bricks'], [2, 'mossy_stone_bricks'], [1, 'cracked_stone_bricks']),
  ),
  tiles(
    pick(1, 'Command', '//smooth'),
    step(3, 'Passes', '4'),
    mask('"##dirt !podzol"', [
      { name: 'include', value: '#dirt' },
      { name: 'exclude', value: 'podzol' },
    ]),
  ),
]

/**
 * The commands the loop plays, each slot with its variations. The loop deals every
 * variation once a round, `//generate` once per shape, in a fresh random order.
 */
export const HERO_SLOTS: readonly HeroSlot[] = [
  GIVE,
  EFFECT,
  GENERATE,
  EXECUTE,
  PALETTE,
  DATA,
  PLAYSOUND,
  PARTICLE,
]
