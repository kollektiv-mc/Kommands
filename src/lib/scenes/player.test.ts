import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { KONNEKT_VARIANTS, SCENE_COMMANDS } from '../../data/home/scenes'
import { startScenes, type ScenePlayer } from './player'

// jsdom has neither observer; the player only needs them to exist.
class Inert {
  observe() {}
  disconnect() {}
}

let host: HTMLElement
let player: ScenePlayer | null = null
const started: number[] = []

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Inert)
  vi.stubGlobal('IntersectionObserver', Inert)
  host = document.createElement('div')
  document.body.append(host)
  started.length = 0
})

afterEach(() => {
  player?.stop()
  host.remove()
  vi.unstubAllGlobals()
})

/** Under reduced motion a scene plays to its end at once; let its microtasks drain. */
async function settle() {
  for (let i = 0; i < 200; i++) await Promise.resolve()
}

async function play(): Promise<ScenePlayer> {
  player = startScenes(host, true, (i) => started.push(i))
  await settle()
  return player
}

const text = (selector: string) =>
  [...host.querySelectorAll(selector)].map((n) => n.textContent ?? '')

test('reduced motion shows the Konnekt scene finished and holds it', async () => {
  await play()
  expect(started).toEqual([0])
  const v = KONNEKT_VARIANTS[0]
  const pick = SCENE_COMMANDS[v.pick]
  expect(text('.kn-cmd.linked')).toContain(pick.name)
  expect(text('.kn-console div').slice(-2)).toEqual([`> ${pick.command.slice(1)}`, pick.response])
  expect(host.querySelector('.kn-cmd.linked')?.closest('.sc-win')?.className).toContain('front')
})

test('the linked command joins Linked to Konnekt in Kommands', async () => {
  await play()
  const linked = host.querySelector('.sc-linked')
  expect(linked?.querySelector('.sc-count')?.textContent).toBe('2')
  expect(linked?.querySelector('.sc-row b')?.textContent).toBe(
    SCENE_COMMANDS[KONNEKT_VARIANTS[0].pick].name,
  )
})

test('the saved command lands first, then is grouped and tagged', async () => {
  const p = await play()
  p.jump(1)
  await settle()
  expect(started).toEqual([0, 1])
  expect(host.querySelector('.sc-tile')?.textContent).toContain('Welcome')
  expect(host.querySelector('.sc-km-total')?.textContent).toBe('6 saved')
  const events = host.querySelector('[data-group="Events"]')
  expect(events?.querySelector('.sc-count')?.textContent).toBe('2')
  expect(events?.nextElementSibling?.textContent).toContain('#join')
  expect(host.querySelector('[data-group="Ungrouped"]')).toBeNull()
})

test('a tab replays its scene with the next variant', async () => {
  const p = await play()
  for (let i = 1; i < KONNEKT_VARIANTS.length; i++) {
    p.jump(0)
    await settle()
  }
  // The last variant runs the command from a Scheduler graph instead.
  const sched = host.querySelector('.kn-sched')
  expect(sched?.className).toContain('armed')
  expect(sched?.querySelector('.kn-field')?.textContent).toBe(
    SCENE_COMMANDS[KONNEKT_VARIANTS[4].pick].name,
  )
  expect(host.querySelectorAll('.sc-win')).toHaveLength(2)
})

test('stop takes the stage away', async () => {
  const p = await play()
  p.stop()
  player = null
  expect(host.children).toHaveLength(0)
})
