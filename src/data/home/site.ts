/*
 * What the home page and the download page say that is not layout: where things are,
 * and the game values their feature tiles show. Game values live under src/data, never
 * in a component, so these do too.
 */

const REPOSITORY = 'https://github.com/kollektiv-mc/Kommands'

/**
 * The snapshot release, the only one published so far. Every download points here until
 * Kommands has a tagged release; then these become `releases/latest/download/...`.
 */
const SNAPSHOT = `${REPOSITORY}/releases/tag/snapshot`
const SNAPSHOT_FILE = `${REPOSITORY}/releases/download/snapshot`

export const SITE = {
  repository: REPOSITORY,
  version: __APP_VERSION__,
  downloads: {
    windows: `${SNAPSHOT_FILE}/kommands-windows-amd64-installer.exe`,
    /**
     * The release workflows build no macOS app yet, so this opens the release rather
     * than a file that does not exist (docs/home-page.md § Open).
     */
    macos: SNAPSHOT,
    /** The RPM's file name carries the build's version, so it is reached from the release. */
    linuxRpm: SNAPSHOT,
    linuxBinary: `${SNAPSHOT_FILE}/kommands-linux-amd64`,
  },
} as const

/** The four Generators tiles' small visuals. */
export const FEATURES = {
  commands: [
    { text: '/give', on: true },
    { text: '/tellraw' },
    { text: '/execute', on: true },
    { text: '//generate', on: true },
    { text: '/effect' },
    { text: '/summon' },
    { text: '/scoreboard' },
    { text: '/particle' },
    { text: '/tp' },
    { text: '/fill' },
    { text: '/gamerule' },
  ],
  execute: [
    { keyword: 'as', value: '@a', colour: 1 },
    { keyword: 'at', value: '@s', colour: 2 },
    { keyword: 'if', value: 'block ~ ~-1 ~ magma_block', colour: 3 },
    { keyword: 'run', value: 'kill @s', colour: 4, on: true },
  ],
  dashboard: [
    { name: 'Starter kit', command: '/give @p diamond_sword', on: true },
    { name: 'Night vision', command: '/effect give @a night_vision' },
    { name: 'Morning', command: '/time set day' },
    { name: 'Tower', command: '//generate stone_bricks' },
  ],
} as const

/** The number of vanilla commands the editor covers, as the tile names it. */
export const COMMAND_COUNT = 78

/** The 3D Editor tile's turning structure: a twisted quartz tower. */
export const FEATURE_SHAPE = {
  colour: '#e4ded3',
  n: 15,
  field: (x: number, y: number, z: number) =>
    Math.abs(x * Math.cos(y * 1.4) - z * Math.sin(y * 1.4)) < 0.5 &&
    Math.abs(x * Math.sin(y * 1.4) + z * Math.cos(y * 1.4)) < 0.5,
} as const
