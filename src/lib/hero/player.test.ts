import { afterEach, expect, test, vi } from 'vitest'
import { cutRows, heroPlays, shuffleRound, startHero } from './player'
import { HERO_SLOTS, HERO_SHAPES } from '../../data/home/hero'
import type { HeroCommand, HeroSlot } from './types'

/** What a command starts with: its own word, or the Palette Editor's Command tile. */
const head = (h: HeroCommand) => {
  const part = h.parts[0]
  return part?.kind === 'literal' ? part.text : (part?.value ?? '')
}

const command = (first: string): HeroCommand => {
  const found = HERO_SLOTS.flat().find((h) => head(h) === first)
  if (!found) throw new Error(`no ${first} in the hero`)
  return found
}

let stop = () => {}
afterEach(() => {
  stop()
  document.body.textContent = ''
})

/** The loop's order is random, so a //generate command is given the first shape only. */
const FIRST_SHAPE = HERO_SHAPES.slice(0, 1)

/** Reduced motion lays a command out finished, in the same microtask chain, and holds it. */
async function play(h: HeroCommand) {
  const host = document.createElement('div')
  document.body.append(host)
  stop = startHero(host, [[h]], FIRST_SHAPE, true)
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
    'cherry_planks',
    '…<0.60*(1-0.45*t)*(1-0.6*(t*2.00%1))',
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

test('every variation of every command lays out finished', async () => {
  for (const h of HERO_SLOTS.flat()) {
    const host = await play(h)
    expect(host.querySelector('.wait'), head(h)).toBeNull()
    stop()
  }
})

test('the Palette Editor shows its command as a tile, and a pattern as its blocks', async () => {
  const host = await play(command('//replace'))
  expect(texts(host, '.hp-lab')).toEqual(['Command', 'Blocks to touch', 'Place'])
  expect(texts(host, '.hp-chip')).toEqual([
    'include stone, andesite',
    'chance 40%',
    'cobblestone 3',
    'mossy_cobblestone 2',
    'gravel 1',
  ])
  expect(texts(host, '.hp-add')).toEqual(['+ rule', '+ block'])
})

test('a round plays everything once, in a fresh random order', () => {
  const plays = heroPlays(HERO_SLOTS, HERO_SHAPES)
  expect(plays.filter((p) => p.v).map((p) => p.v)).toEqual(HERO_SHAPES)
  const firsts = new Set<unknown>()
  let last: HeroSlot | undefined
  for (let r = 0; r < 50; r++) {
    const round = shuffleRound(plays, last)
    expect(new Set(round)).toEqual(new Set(plays))
    // No command twice in a row, within a round or across the wrap from the last.
    round.forEach((p, i) => expect(p.slot).not.toBe(i ? round[i - 1]?.slot : last))
    firsts.add(round[0])
    last = round.at(-1)?.slot
  }
  expect(firsts.size).toBeGreaterThan(1)
})

test('stopping ends the loop without an error', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const end = startHero(host, HERO_SLOTS, HERO_SHAPES, false)
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
  stop = startHero(host, [[h]], FIRST_SHAPE, false)
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

test('rows are cut so every row of typed text fits, then by the widest tile row', () => {
  const gap = { tile: 10, text: 10 }
  const tiles = [50, 200, 200, 50]
  // Two rows by tiles alone would be [50 200] [200 50]; the text of the second is too wide.
  expect(cutRows({ tiles, text: [40, 100, 300, 40] }, gap, 400, 2)).toEqual([2])
  expect(cutRows({ tiles: [200, 50, 50, 200], text: [90, 90, 90, 90] }, gap, 400, 2)).toEqual([2])
  // Nothing fits in two rows, so it takes three rather than wrap.
  expect(cutRows({ tiles, text: [40, 300, 300, 300] }, gap, 400, 2)).toEqual([2, 3])
  // A part wider than the room on its own cannot be placed.
  expect(cutRows({ tiles, text: [40, 500, 40, 40] }, gap, 400, 1)).toBeNull()
})
