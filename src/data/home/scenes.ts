/**
 * What the download page's scenes show: saved commands, a Konnekt server's console,
 * and the variants each scene cycles through. docs/home-page.md § The download page.
 *
 * Game text is the 1.21.1 `en_us.json` wording for each command's success message, and
 * the player names are the four every mockup in this suite uses.
 */

export interface SceneCommand {
  name: string
  command: string
  group: string
  date: string
  /** What the server's console answers when Konnekt runs it. */
  response?: string
}

const COMMANDS = {
  nightVision: {
    name: 'Night vision',
    command: '/effect give @a night_vision infinite 0 true',
    group: 'Effects',
    date: '3 Nov 2026',
    response: 'Applied effect Night Vision to 4 targets',
  },
  kit: {
    name: 'Starter kit',
    command: '/give @p diamond_sword[enchantments={levels:{sharpness:5}}] 1',
    group: 'Kits',
    date: '2 Nov 2026',
    response: 'Gave 1 [Diamond Sword] to Snadrochka',
  },
  morning: {
    name: 'Morning',
    command: '/time set day',
    group: 'Events',
    date: '9 Nov 2026',
    response: 'Set the time to 1000',
  },
  keep: {
    name: 'Keep inventory',
    command: '/gamerule keepInventory true',
    group: 'Rules',
    date: '28 Oct 2026',
    response: 'Gamerule keepInventory is now set to: true',
  },
  clear: {
    name: 'Clear weather',
    command: '/weather clear',
    group: 'Events',
    date: '5 Nov 2026',
    response: 'Set the weather to clear',
  },
  welcome: {
    name: 'Welcome',
    command: '/tellraw @a {"text":"Welcome back","color":"gold"}',
    group: 'Events',
    date: '13 Nov 2026',
  },
  flame: {
    name: 'Flame trail',
    command: '/execute as @a at @s run particle flame ~ ~1 ~ 0.3 0.3 0.3 0.01 10',
    group: 'Effects',
    date: '13 Nov 2026',
  },
  dome: {
    name: 'Dome',
    command: '//generate stone x^2+y^2+z^2<1',
    group: 'Builds',
    date: '4 Nov 2026',
  },
  ring: {
    name: 'Glass ring',
    command: '//generate glass (0.7-sqrt(x^2+z^2))^2+y^2<0.09',
    group: 'Builds',
    date: '7 Nov 2026',
  },
  spire: {
    name: 'Spire',
    command: '//generate oak_planks sqrt(x^2+z^2)<(1-y)/2',
    group: 'Builds',
    date: '13 Nov 2026',
  },
  pyramid: {
    name: 'Step pyramid',
    command: '//generate sandstone abs(x)+abs(z)<(1-y)/2',
    group: 'Builds',
    date: '6 Nov 2026',
  },
} satisfies Record<string, SceneCommand>

export type SceneCommandKey = keyof typeof COMMANDS

export const SCENE_COMMANDS: Record<SceneCommandKey, SceneCommand> = COMMANDS

/**
 * A console line: its tone (plain, a join in green, a warning in yellow, or what was
 * sent to the server) and its text.
 */
export type ConsoleLine = ['' | 'ok' | 'warn' | 'sent', string]

export const CONSOLE_LOG: ConsoleLine[] = [
  ['', 'Starting minecraft server version 1.21.1'],
  ['', 'Loading properties'],
  ['', 'Default game type: SURVIVAL'],
  ['', 'Starting Minecraft server on *:25565'],
  ['', 'Preparing level "world"'],
  ['', 'Preparing spawn area: 100%'],
  ['ok', 'Done (6.129s)! For help, type "help"'],
  ['', 'Snadrochka[/192.168.1.24:53114] logged in with entity id 214'],
  ['ok', 'Snadrochka joined the game'],
  ['ok', 'crocodealer420 joined the game'],
  ['', '<Snadrochka> anyone got spare diamonds'],
  ['ok', 'frogipogi joined the game'],
  ['warn', "Can't keep up! Is the server overloaded? Running 2841ms or 56 ticks behind"],
  ['ok', 'ceramichello joined the game'],
  ['', '<frogipogi> the nether portal at spawn is broken again'],
]

export const PLAYERS = ['Snadrochka', 'crocodealer420', 'frogipogi', 'ceramichello']

export const SERVERS = ['Survival', 'Creative', 'Event']

/** Konnekt's tiles in the sidebar list, and the buttons its Commands tile starts with. */
export const KONNEKT_TILES = [
  'Console',
  'Overview',
  'Players',
  'Commands',
  'Performance',
  'Scheduler',
  'Worlds',
  'Backups',
]
export const KONNEKT_BUTTONS = ['Start', 'Stop', 'Restart', 'Force Stop', 'Save All', 'TPS']
export const SCHEDULER_COMMANDS = ['Start Server', 'Stop Server', 'Save All', 'Set Day']

/**
 * Konnekt's tile layouts, as grid areas: `con` console, `cmd` commands, `pl` players,
 * `ov` overview, `pf` performance, `sch` scheduler.
 */
export type KonnektLayout = 'console' | 'overview' | 'split' | 'scheduler'

export interface KonnektVariant {
  layout: KonnektLayout
  server: string
  saved: SceneCommandKey[]
  linked: SceneCommandKey[]
  /** The command linked in Kommands and run from Konnekt. */
  pick: SceneCommandKey
}

export const KONNEKT_VARIANTS: KonnektVariant[] = [
  {
    layout: 'console',
    server: 'Survival',
    saved: ['kit', 'nightVision', 'dome', 'clear'],
    linked: ['morning'],
    pick: 'nightVision',
  },
  {
    layout: 'overview',
    server: 'Survival',
    saved: ['welcome', 'keep', 'ring', 'kit'],
    linked: ['nightVision'],
    pick: 'kit',
  },
  {
    layout: 'split',
    server: 'Event',
    saved: ['morning', 'flame', 'pyramid', 'keep'],
    linked: ['clear'],
    pick: 'keep',
  },
  {
    layout: 'console',
    server: 'Creative',
    saved: ['spire', 'clear', 'nightVision', 'morning'],
    linked: ['keep'],
    pick: 'morning',
  },
  {
    layout: 'scheduler',
    server: 'Survival',
    saved: ['kit', 'nightVision', 'morning', 'clear'],
    linked: ['keep'],
    pick: 'morning',
  },
]

export interface SavedVariant {
  /** The command saved from the editor. */
  add: SceneCommandKey
  base: SceneCommandKey[]
  generator: string
  fields: [string, string][]
  group: string
  tag: string
}

export const SAVED_VARIANTS: SavedVariant[] = [
  {
    add: 'welcome',
    base: ['kit', 'nightVision', 'dome', 'clear', 'keep'],
    generator: '/tellraw',
    fields: [
      ['targets', '@a'],
      ['message', 'Welcome back'],
      ['color', 'gold'],
    ],
    group: 'Events',
    tag: 'join',
  },
  {
    add: 'flame',
    base: ['morning', 'ring', 'kit', 'nightVision', 'welcome'],
    generator: '/execute',
    fields: [
      ['as', '@a'],
      ['at', '@s'],
      ['run', 'particle flame ~ ~1 ~'],
    ],
    group: 'Effects',
    tag: 'particles',
  },
  {
    add: 'spire',
    base: ['dome', 'clear', 'pyramid', 'keep', 'kit'],
    generator: '//generate',
    fields: [
      ['pattern', 'oak_planks'],
      ['expression', 'sqrt(x^2+z^2)<(1-y)/2'],
    ],
    group: 'Builds',
    tag: 'castle',
  },
  {
    add: 'kit',
    base: ['welcome', 'nightVision', 'ring', 'morning', 'flame'],
    generator: '/give',
    fields: [
      ['targets', '@p'],
      ['item', 'diamond_sword'],
      ['enchantments', 'sharpness 5'],
      ['count', '1'],
    ],
    group: 'Kits',
    tag: 'spawn',
  },
]

/** The date a command saved during a scene carries. */
export const SAVED_TODAY = '14 Nov 2026'

/** Each scene's tab label and how long it plays before the next. */
export const SCENES = [
  { id: 'konnekt', label: 'Konnekt', ms: 11500 },
  { id: 'saved', label: 'Saved commands', ms: 13000 },
] as const

export type SceneId = (typeof SCENES)[number]['id']
