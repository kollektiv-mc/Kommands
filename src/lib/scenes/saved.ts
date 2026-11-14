/**
 * The Saved commands scene: a command is saved from the editor, its tile lands first in
 * the dashboard's grid, and it is browsed, dragged into a group, and tagged.
 */
import { chevron, el, find, findAll } from '../hero/dom'
import {
  SAVED_TODAY,
  SAVED_VARIANTS,
  SCENE_COMMANDS,
  type SavedVariant,
  type SceneCommandKey,
} from '../../data/home/scenes'
import { copyIcon, searchIcon } from './icons'
import { STAGE_W, stageWindow, type Stage } from './stage'
import { kommandsWindow, savedTile } from './windows'

const KOMMANDS_BOX = { left: 40, top: 24, width: 880, height: 552 }
const DRAG_EASE = 'cubic-bezier(.45,.05,.25,1)'

/** The editor sheet over the dimmed dashboard, with its save popover closed. */
function sheet(v: SavedVariant): HTMLElement {
  const s = SCENE_COMMANDS[v.add]
  const popover = el(
    'div',
    'sc-pop out',
    el('label', '', 'Name', el('div', 'sc-input')),
    el('label', '', 'Group', el('div', 'sc-select', el('span', '', 'None'), chevron())),
    el('span', 'sc-btn primary sc-go', 'Save'),
  )
  const fields = v.fields.map(([k, value]) =>
    el('div', 'sc-field', el('span', '', k), el('div', '', value)),
  )
  return el(
    'div',
    'sc-sheet',
    el(
      'div',
      'sc-sheet-head',
      el('span', 'sc-sheet-tag', 'EDITOR'),
      el('span', 'sc-sheet-gen', v.generator),
      chevron(),
      el('span', 'sc-key', 'Esc'),
    ),
    el(
      'div',
      'sc-sheet-body',
      el(
        'div',
        'sc-sheet-cmd',
        el('div', 'sc-line', s.command),
        el(
          'div',
          'sc-actions',
          el('span', 'sc-status', 'Ready'),
          el('span', 'sc-btn sc-save', 'Save...'),
          el('span', 'sc-btn primary', copyIcon(), el('span', '', 'Copy')),
          popover,
        ),
      ),
      el('div', 'sc-fields', ...fields),
    ),
  )
}

/** Save it: name it in the popover, and the sheet closes onto the dashboard. */
async function save(x: Stage, v: SavedVariant, win: HTMLElement) {
  await x.to(find(win, '.sc-save'), 800)
  await x.click()
  const pop = find(win, '.sc-pop')
  pop.classList.remove('out')
  await x.wait(300)
  await x.type(find(pop, '.sc-input'), SCENE_COMMANDS[v.add].name, 70)
  await x.wait(250)
  await x.to(find(pop, '.sc-go'), 600)
  await x.click()
  pop.classList.add('out')
  await x.wait(200)
  find(win, '.sc-sheet').classList.add('out')
  find(win, '.sc-km-body').classList.remove('dim')
  await x.wait(350)
}

/** The new tile lands first in the grid, and the tiles it displaces slide along. */
function land(x: Stage, v: SavedVariant, win: HTMLElement) {
  const grid = find(win, '.sc-grid')
  const tiles = findAll(grid, '.sc-tile')
  const before = new Map(tiles.map((t) => [t, t.getBoundingClientRect()]))
  const fresh = savedTile(v.add, { fresh: true, date: SAVED_TODAY })
  grid.prepend(fresh)
  if (!x.fast) {
    const k = x.root.getBoundingClientRect().width / STAGE_W || 1
    for (const [t, b] of before) {
      const n = t.getBoundingClientRect()
      const from = `translate(${(b.left - n.left) / k}px, ${(b.top - n.top) / k}px)`
      t.animate([{ transform: from }, { transform: 'none' }], { duration: 450, easing: DRAG_EASE })
    }
    fresh.animate(
      [
        { opacity: 0, transform: 'scale(.85)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 450, easing: DRAG_EASE },
    )
  }
  const total = v.base.length + 1
  find(win, '.sc-km-total').textContent = `${total} saved`
  const count = find(find(win, '.sc-saved'), '.sc-count')
  count.textContent = String(total)
  count.classList.add('bump')
}

const browseRow = (key: SceneCommandKey, className = 'sc-browse-row') =>
  el(
    'div',
    className,
    el('b', '', SCENE_COMMANDS[key].name),
    el('span', '', SCENE_COMMANDS[key].command),
    el('span', 'sc-tags'),
  )

function groupHead(name: string, count: number): HTMLElement {
  const head = el('div', 'sc-group', chevron(), name, el('span', 'sc-count', String(count)))
  head.dataset.group = name
  return head
}

/** The browser over the saved panel, by group, with the new command still ungrouped. */
function browser(v: SavedVariant): HTMLElement {
  const groups = new Map<string, SceneCommandKey[]>([[v.group, []]])
  for (const k of v.base) {
    const g = SCENE_COMMANDS[k].group
    groups.set(g, [...(groups.get(g) ?? []), k])
  }
  const list = el('div', 'sc-browse-list')
  for (const g of [...groups.keys()].sort()) {
    const keys = groups.get(g) ?? []
    list.append(groupHead(g, keys.length), ...keys.map((k) => browseRow(k)))
  }
  list.append(groupHead('Ungrouped', 1), browseRow(v.add, 'sc-browse-row new'))
  const modes = el(
    'span',
    'sc-modes',
    el('span', 'on', 'Groups'),
    el('span', '', 'Generators'),
    el('span', '', 'List'),
  )
  return el(
    'div',
    'sc-browser',
    el('div', 'sc-browse-bar', el('span', 'sc-search', searchIcon(), 'Search'), modes),
    list,
  )
}

/** Drag the new row onto its group's header, drop it there, and tag it. */
async function file(x: Stage, v: SavedVariant, win: HTMLElement) {
  const row = find(win, '.sc-browse-row.new')
  const target = find(win, `[data-group="${v.group}"]`)
  const from = x.centre(row)
  const to = x.centre(target)
  await x.to([from[0] - 120, from[1]], 700)
  row.classList.add('lift')
  await x.wait(200)
  row.style.transition = x.fast ? 'none' : `transform 900ms ${DRAG_EASE}`
  row.style.transform = `translateY(${to[1] - from[1]}px)`
  target.classList.add('hot')
  await x.to([from[0] - 120, to[1]], 900)
  await x.wait(200)

  target.classList.remove('hot')
  row.classList.remove('lift')
  row.style.transition = 'none'
  row.style.transform = ''
  target.after(row)
  find(win, '[data-group="Ungrouped"]').remove()
  const count = find(target, '.sc-count')
  count.textContent = String(Number(count.textContent) + 1)
  count.classList.add('bump')
  await x.wait(500)

  const tags = find(row, '.sc-tags')
  const add = el('em', 'sc-tag-add', '+ tag')
  tags.replaceChildren(add)
  await x.to(add, 700)
  await x.click()
  const tag = el('em', '', '#')
  tags.replaceChildren(tag)
  await x.type(tag, `#${v.tag}`, 80)
}

export async function playSaved(x: Stage, variant: number) {
  const v = SAVED_VARIANTS[variant % SAVED_VARIANTS.length]
  const pins = ['//generate', v.generator === '//generate' ? '/give' : v.generator]
  const dashboard = kommandsWindow({
    saved: v.base.map((key) => ({ key })),
    linked: ['nightVision'],
    quick: ['clear'],
    recent: [v.add, 'dome'],
    pins,
    cols: 3,
  })
  find(dashboard, '.sc-km-body').classList.add('dim')
  dashboard.append(sheet(v))
  const win = stageWindow(KOMMANDS_BOX, 'front opening', dashboard)
  x.mount(win)
  await x.open(win)

  await save(x, v, win)
  land(x, v, win)
  await x.wait(1000)

  const browse = find(win, '.sc-browse')
  await x.to(browse, 800)
  await x.click()
  browse.classList.add('on')
  const panel = browser(v)
  find(win, '.sc-saved').append(panel)
  void panel.offsetWidth
  panel.classList.add('on')
  await x.wait(700)
  await file(x, v, win)
  await x.wait(1500)
}
