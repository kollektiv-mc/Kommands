/**
 * The Konnekt scene: a saved command is linked in Kommands, lands in Konnekt, and is
 * run there, as a button on its Commands tile or as the Command block of a Scheduler
 * graph. The console answers in the game's own words.
 */
import { el, find } from '../hero/dom'
import {
  CONSOLE_LOG,
  KONNEKT_VARIANTS,
  SCENE_COMMANDS,
  type SceneCommandKey,
} from '../../data/home/scenes'
import { linkIcon } from './icons'
import { stageWindow, type Box, type Stage } from './stage'
import { consoleLine, kommandsWindow, konnektWindow, linkedButton, listRow } from './windows'

/** How many console lines stay on screen as new ones arrive. */
const CONSOLE_ROWS = 12

function menuItem(key: SceneCommandKey, fresh: boolean): HTMLElement {
  const s = SCENE_COMMANDS[key]
  return el('div', fresh ? 'fresh' : '', linkIcon(), s.name, el('small', '', s.command.slice(1)))
}

/** Into the Scheduler: choose the linked command in the Command block, then arm it. */
async function schedule(x: Stage, pick: SceneCommandKey, linked: SceneCommandKey[]) {
  const sched = find(x.root, '.kn-sched')
  const field = find(sched, '.kn-field')
  const menu = find(sched, '.kn-menu')
  find(menu, '.kn-menu-linked').append(
    ...linked.map((k) => menuItem(k, false)),
    menuItem(pick, true),
  )

  await x.to(field, 900)
  await x.click()
  field.classList.add('on')
  menu.classList.add('on')
  await x.wait(650)
  const item = find(menu, '.fresh')
  await x.to(item, 700)
  item.classList.add('hot')
  await x.click()
  menu.classList.remove('on')
  field.classList.replace('on', 'set')
  field.replaceChildren(linkIcon(), el('span', '', SCENE_COMMANDS[pick].name))
  await x.wait(700)

  const sw = find(sched, '.kn-switch')
  await x.to(sw, 800)
  await x.click()
  sw.classList.add('on')
  sched.classList.add('armed')
  find(sched, '.kn-armed').textContent = '2 / 2'
  await x.wait(600)
  const [cx, cy] = x.centre(sw)
  await x.to([cx + 40, cy + 90], 800)
}

/** On the Commands tile: the new button appears, is pressed, and the console answers. */
async function run(x: Stage, pick: SceneCommandKey) {
  find(x.root, '.kn-cmds').append(linkedButton(pick, true))
  await x.wait(700)
  const button = find(x.root, '.kn-cmd.fresh')
  await x.to(button, 900)
  button.classList.add('press')
  await x.click()
  button.classList.remove('press')
  const log = find(x.root, '.kn-console')
  const add = (line: HTMLElement) => {
    log.append(line)
    if (log.children.length > CONSOLE_ROWS) log.firstElementChild?.remove()
  }
  const s = SCENE_COMMANDS[pick]
  await x.wait(200)
  add(consoleLine(['sent', `> ${s.command.slice(1)}`], true))
  await x.wait(450)
  add(consoleLine(['', s.response ?? ''], true))
  const [cx, cy] = x.centre(button)
  await x.to([cx + 60, cy + 70], 800)
}

export async function playKonnekt(x: Stage, variant: number) {
  const v = KONNEKT_VARIANTS[variant % KONNEKT_VARIANTS.length]
  // Kommands sits over Konnekt's Commands tile, on whichever side the layout puts it.
  const right = v.layout !== 'split'
  const knBox: Box = { left: right ? 16 : 164, top: 18, width: 780, height: 548 }
  const kmBox: Box = { left: right ? 430 : 18, top: 70, width: 512, height: 430 }

  const kn = stageWindow(knBox, 'back', konnektWindow(v.layout, v.server, CONSOLE_LOG, v.linked))
  const km = stageWindow(
    kmBox,
    'front opening',
    kommandsWindow({
      saved: v.saved.map((key) => ({ key, linked: v.linked.includes(key) })),
      linked: v.linked,
      quick: ['clear'],
      compact: true,
      cols: 2,
    }),
  )
  x.mount(kn, km)
  await x.open(km)

  // Link it in Kommands: the tile's link lights, and it joins Linked to Konnekt.
  const link = find(km, `.sc-tile[data-key="${v.pick}"] .sc-link`)
  await x.to(link, 900)
  await x.click()
  link.classList.add('on')
  const linked = find(km, '.sc-linked')
  find(linked, '.sc-list').prepend(listRow(v.pick, true))
  const count = find(linked, '.sc-count')
  count.textContent = String(v.linked.length + 1)
  count.classList.add('bump')
  await x.wait(1100)

  // Over to Konnekt, which comes forward with the command.
  await x.to(right ? [190, 330] : [850, 330], 1000)
  await x.click()
  x.raise(kn, km)
  await x.wait(800)
  if (v.layout === 'scheduler') {
    await schedule(x, v.pick, v.linked)
    await x.wait(1200)
  } else {
    await run(x, v.pick)
  }
}
