import { afterEach, expect, test, vi } from 'vitest'
import { startHero } from './player'
import { HERO_SEQUENCE, HERO_SHAPES } from '../../data/home/hero'
import type { HeroCommand } from './types'

const command = (first: string): HeroCommand => {
  const found = HERO_SEQUENCE.find(
    (h) => h.parts[0]?.kind === 'literal' && h.parts[0].text === first,
  )
  if (!found) throw new Error(`no ${first} in the hero`)
  return found
}

let stop = () => {}
afterEach(() => {
  stop()
  document.body.textContent = ''
})

/** Reduced motion lays a command out finished, in the same microtask chain, and holds it. */
async function play(h: HeroCommand) {
  const host = document.createElement('div')
  document.body.append(host)
  stop = startHero(host, [h], HERO_SHAPES, true)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  return host
}

const texts = (host: Element, selector: string) =>
  [...host.querySelectorAll(selector)].map((e) => e.textContent)

test('under reduced motion a command shows finished, as tiles with labels', async () => {
  const host = await play(command('/give'))
  expect(host.querySelector('.hero-cmd')?.classList.contains('tiles')).toBe(true)
  expect(texts(host, '.hp-lab').filter(Boolean)).toEqual(['Recipients', 'Item stack', 'Count'])
  expect(texts(host, '.hp-vt')).toEqual(['/give', '@p', 'diamond_sword', '1'])
  expect(texts(host, '.hp-chip')).toEqual(['enchantments sharpness 5'])
  expect(host.querySelector('.wait')).toBeNull()
})

test('a //generate command names the block and the expression it builds', async () => {
  const host = await play(command('//generate'))
  expect(host.hasAttribute('data-viz')).toBe(true)
  expect(texts(host, '.hp-vt')).toEqual([
    '//generate',
    'stone_bricks',
    'sqrt(x^2+z^2)<0.40&&y<0.10',
  ])
  expect(host.querySelector('canvas')).not.toBeNull()
})

test('/execute lays its steps out beside it, run last', async () => {
  const host = await play(command('/execute'))
  expect(host.querySelector('.hero-cmd')?.classList.contains('tiles')).toBe(false)
  expect(texts(host, '.hero-step-pill')).toEqual(['as', 'at', 'if', 'unless', 'run'])
  expect(texts(host, '.hero-step-val')[0]).toBe('@a[team=red]')
  expect(host.querySelector('.hero-step.run')).toBe(host.querySelector('.hero-step:last-child'))
})

test('a command whose control holds only chips drops the control', async () => {
  const host = await play(command('/data merge'))
  const nbt = [...host.querySelectorAll('.hp')].find((p) => p.textContent?.includes('NBT'))
  expect(nbt?.querySelector('.hp-ctl')?.classList.contains('lo')).toBe(true)
  expect(texts(host, '.hp-add')).toEqual(['+ Add tag'])
})

test('stopping ends the loop without an error', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const end = startHero(host, HERO_SEQUENCE, HERO_SHAPES, false)
  end()
  await new Promise((r) => setTimeout(r, 30))
  expect(host.querySelector('.hero-cmd')).not.toBeNull()
})

/**
 * The full motion path, with every frame landing far enough ahead that each wait ends
 * on its first tick. jsdom has no Web Animations, so `animate` is a no-op.
 */
async function playThrough(h: HeroCommand) {
  let now = 0
  const raf = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((tick) => (queueMicrotask(() => tick((now += 10_000))), 0))
  const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel() {} }))
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true })
  const host = document.createElement('div')
  document.body.append(host)
  stop = startHero(host, [h], HERO_SHAPES, false)
  for (let i = 0; i < 5000 && !host.hasAttribute('data-out'); i++) await Promise.resolve()
  stop()
  raf.mockRestore()
  Reflect.deleteProperty(Element.prototype, 'animate')
  return { host, animate }
}

test('a //generate command plays through to its exit', async () => {
  const { host } = await playThrough(command('//generate'))
  expect(host.hasAttribute('data-out')).toBe(true)
  expect(host.querySelector('.hero-cmd')?.classList.contains('tiles')).toBe(true)
})

test('/execute plays its steps through to its exit', async () => {
  const { host, animate } = await playThrough(command('/execute'))
  expect(host.hasAttribute('data-out')).toBe(true)
  expect(texts(host, '.hero-step-pill')).toEqual(['as', 'at', 'if', 'unless', 'run'])
  expect(animate).toHaveBeenCalled()
})
