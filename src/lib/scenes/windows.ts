/**
 * The two app windows the scenes stage: Kommands' dashboard and Konnekt's tile grid.
 *
 * Both are pictures of the apps rather than the apps, built from the same tokens so a
 * theme carries them, and laid out in the stage's fixed logical pixels. Konnekt's is
 * Konnekt's own accent on the shared canvas, which is all that separates the two
 * products' looks (`lib/theme.ts`).
 */
import { chevron, el, icon, shape, stroke } from '../hero/dom'
import {
  KONNEKT_BUTTONS,
  KONNEKT_TILES,
  PLAYERS,
  SCENE_COMMANDS,
  SCHEDULER_COMMANDS,
  SERVERS,
  type ConsoleLine,
  type KonnektLayout,
  type SceneCommandKey,
} from '../../data/home/scenes'
import { editIcon, gearIcon, linkIcon, markIcon, pinIcon, searchIcon } from './icons'

const text = (tag: 'b' | 'span' | 'small' | 'div' | 'i', className: string, value: string) =>
  el(tag, className, value)

// ── Kommands ────────────────────────────────────────────────────────────────

export interface TileOptions {
  linked?: boolean
  date?: string
  fresh?: boolean
}

/** A saved command's tile on the dashboard: name, command, date, and its three icons. */
export function savedTile(key: SceneCommandKey, o: TileOptions = {}): HTMLElement {
  const s = SCENE_COMMANDS[key]
  const link = el('span', o.linked ? 'sc-link on' : 'sc-link', linkIcon())
  const tile = el(
    'div',
    o.fresh ? 'sc-tile fresh' : 'sc-tile',
    text('div', 'sc-tile-name', s.name),
    text('div', 'sc-tile-cmd', s.command),
    el(
      'div',
      'sc-tile-foot',
      text('span', '', o.date ?? s.date),
      el('span', 'sc-tile-icons', link, el('span', '', pinIcon()), el('span', '', editIcon())),
    ),
  )
  tile.dataset.key = key
  return tile
}

/** A row in one of the dashboard's side lists; a linked row carries the link icon. */
export function listRow(key: SceneCommandKey, linked = false): HTMLElement {
  const s = SCENE_COMMANDS[key]
  const name = el('b', '', s.name)
  if (linked) name.append(linkIcon())
  return el('div', 'sc-row', name, text('span', '', s.command))
}

function panel(title: string, count: number, className: string, ...body: HTMLElement[]) {
  return el(
    'div',
    `sc-panel ${className}`,
    el(
      'div',
      'sc-panel-head',
      el('span', 'sc-chev', chevron()),
      title,
      text('span', 'sc-count', String(count)),
    ),
    ...body,
  )
}

export interface KommandsOptions {
  saved: { key: SceneCommandKey; linked?: boolean }[]
  linked: SceneCommandKey[]
  quick: SceneCommandKey[]
  recent?: SceneCommandKey[]
  pins?: string[]
  /** The small window beside Konnekt: no pins and no Recent list. */
  compact?: boolean
  cols: number
}

/** Kommands' dashboard: pinned generators, the saved-command grid, and the side lists. */
export function kommandsWindow(o: KommandsOptions): HTMLElement {
  const grid = el('div', 'sc-grid', ...o.saved.map((s) => savedTile(s.key, { linked: s.linked })))
  grid.style.setProperty('--cols', String(o.cols))
  const browse = el('span', 'sc-browse', searchIcon(), 'Browse')
  const saved = panel(
    'Saved commands',
    o.saved.length,
    'sc-saved',
    el('div', 'sc-panel-body', grid),
  )
  saved.querySelector('.sc-panel-head')?.append(browse)

  const side = el('div', o.compact ? 'sc-side compact' : 'sc-side')
  if (!o.compact && o.recent) {
    side.append(
      panel(
        'Recent',
        o.recent.length,
        '',
        el('div', 'sc-list', ...o.recent.map((k) => listRow(k))),
      ),
    )
  }
  side.append(
    panel('Quick', o.quick.length, '', el('div', 'sc-list', ...o.quick.map((k) => listRow(k)))),
    panel(
      'Linked to Konnekt',
      o.linked.length,
      'sc-linked',
      el('div', 'sc-list', ...o.linked.map((k) => listRow(k, true))),
    ),
  )

  const body = el(
    'div',
    'sc-km-body',
    el(
      'div',
      'sc-km-head',
      text('b', '', 'Dashboard'),
      text('span', 'sc-km-total', `${o.saved.length} saved`),
      text('span', 'sc-km-new', 'New command'),
    ),
  )
  if (!o.compact && o.pins) {
    const pins = el('div', 'sc-pins', ...o.pins.map((p) => text('span', 'sc-pin', p)))
    body.append(panel('Pinned generators', o.pins.length, '', pins))
  }
  body.append(el('div', 'sc-km-main', saved, side))

  return el(
    'div',
    'sc-km',
    el('div', 'sc-km-title', markIcon(), 'Kommands', el('span', 'sc-gear', gearIcon())),
    body,
  )
}

// ── Konnekt ─────────────────────────────────────────────────────────────────

const LAYOUTS: Record<KonnektLayout, { areas: string; rows: string; cols: string }> = {
  console: { areas: "'con cmd' 'con pl'", rows: '1.15fr .85fr', cols: '1.45fr 1fr' },
  overview: { areas: "'ov cmd' 'con cmd'", rows: '.8fr 1.3fr', cols: '1.35fr 1fr' },
  split: { areas: "'cmd con' 'pf con'", rows: '1fr .8fr', cols: '1fr 1.35fr' },
  scheduler: { areas: "'con sch'", rows: '1fr', cols: '1fr 1.3fr' },
}

function knPanel(area: string, title: string, ...body: HTMLElement[]) {
  const p = el(
    'div',
    'kn-panel',
    el('div', 'kn-panel-head', title, text('span', 'kn-x', '⤢ ×')),
    ...body,
  )
  p.style.gridArea = area
  return p
}

export function consoleLine([tone, line]: ConsoleLine, fresh = false): HTMLElement {
  return text('div', `${tone}${fresh ? ' fresh' : ''}`, line)
}

const stat = (label: string, value: string, ok = false) =>
  el('span', '', label, text('b', ok ? 'ok' : '', value))

const perfChart = () =>
  icon(200, '0 0 200 80', (s) => {
    s.setAttribute('preserveAspectRatio', 'none')
    shape(s, 'path', {
      d: 'M0 30 C30 22 50 20 70 34 S120 60 150 56 200 44 200 44',
      class: 'mem',
      ...stroke('1.4'),
    })
    shape(s, 'path', {
      d: 'M0 26 C40 24 70 28 100 30 S160 30 200 31',
      class: 'cpu',
      ...stroke('1.4'),
    })
    shape(s, 'path', { d: 'M0 70 C50 68 100 66 200 66', class: 'tps', ...stroke('1.4') })
  })

function scheduler(): HTMLElement {
  const menu = el(
    'div',
    'kn-menu',
    ...SCHEDULER_COMMANDS.map((c) => text('div', '', c)),
    text('div', 'kn-menu-section', 'Linked from Kommands'),
    el('div', 'kn-menu-linked'),
  )
  return el(
    'div',
    'kn-sched',
    el(
      'div',
      'kn-sched-head',
      text('b', 'kn-armed', '1 / 2'),
      'armed',
      text('span', '', 'next 47m'),
    ),
    el('div', 'kn-sched-name', text('span', '', 'Daybreak'), el('span', 'kn-switch')),
    el(
      'div',
      'kn-sched-graph',
      el(
        'div',
        'kn-node trigger',
        text('i', '', 'Trigger'),
        text('b', '', 'Time of Day'),
        text('small', '', '06:00'),
      ),
      el(
        'div',
        'kn-node',
        text('i', '', 'Action'),
        text('b', '', 'Command'),
        el('div', 'kn-field', text('span', '', 'Choose a command'), chevron()),
        menu,
      ),
    ),
  )
}

function konnektTiles(
  lines: ConsoleLine[],
  linked: SceneCommandKey[],
): Record<string, HTMLElement> {
  const buttons = KONNEKT_BUTTONS.map((b) => el('div', 'kn-cmd', text('b', '', b)))
  const linkedButtons = linked.map((k) => linkedButton(k))
  return {
    con: knPanel(
      'con',
      'Console',
      el('div', 'kn-console', ...lines.map((l) => consoleLine(l))),
      el('div', 'kn-input', text('span', '', '>'), text('div', '', 'Enter command...')),
    ),
    cmd: knPanel('cmd', 'Commands', el('div', 'kn-cmds', ...buttons, ...linkedButtons)),
    pl: knPanel(
      'pl',
      'Players',
      el(
        'div',
        'kn-players',
        el('div', 'kn-big', `${PLAYERS.length} `, text('small', '', 'of 20 online')),
        ...PLAYERS.map((p) => text('div', 'kn-player', p)),
      ),
    ),
    ov: knPanel(
      'ov',
      'Overview',
      el(
        'div',
        'kn-stats',
        el('span', 'kn-online', '● Online'),
        el('span'),
        stat('Players', `${PLAYERS.length} / 20`),
        stat('TPS', '19.8', true),
        stat('Uptime', '3h 12m'),
        stat('Memory', '70%'),
      ),
    ),
    sch: knPanel('sch', 'Scheduler', scheduler()),
    pf: knPanel(
      'pf',
      'Performance',
      el('div', 'kn-stats', stat('TPS', '20.0', true), stat('CPU', '30.5%')),
      el('div', 'kn-perf', perfChart()),
    ),
  }
}

/** A command linked from Kommands, as a button on Konnekt's Commands tile. */
export function linkedButton(key: SceneCommandKey, fresh = false): HTMLElement {
  return el(
    'div',
    fresh ? 'kn-cmd linked fresh' : 'kn-cmd linked',
    el('b', '', linkIcon(), SCENE_COMMANDS[key].name),
  )
}

/** Konnekt: its server list and tile list, and the tile grid in one of its layouts. */
export function konnektWindow(
  layout: KonnektLayout,
  server: string,
  lines: ConsoleLine[],
  linked: SceneCommandKey[],
): HTMLElement {
  const l = LAYOUTS[layout]
  const tiles = konnektTiles(lines, linked)
  const used = [...new Set(l.areas.match(/[a-z]+/g) ?? [])]
  const grid = el('div', 'kn-grid', ...used.map((u) => tiles[u]).filter((t) => t !== undefined))
  grid.style.gridTemplateAreas = l.areas
  grid.style.gridTemplateRows = l.rows
  grid.style.gridTemplateColumns = l.cols

  const servers = el(
    'div',
    'kn-servers',
    ...SERVERS.map((s) => text('div', s === server ? 'on' : '', s)),
  )
  const tileList = el('div', 'kn-tiles', ...KONNEKT_TILES.map((t) => text('div', '', t)))
  return el(
    'div',
    'kn',
    el('div', 'kn-title', 'Konnekt', text('span', 'kn-controls', '⚙ – ▢ ×')),
    el(
      'div',
      'kn-main',
      el(
        'div',
        'kn-side',
        el('div', 'kn-panel', el('div', 'kn-panel-head', chevron(), 'Servers'), servers),
        el('div', 'kn-panel grow', el('div', 'kn-panel-head', chevron(), 'Tiles'), tileList),
      ),
      grid,
    ),
  )
}
