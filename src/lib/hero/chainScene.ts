/** The `/execute` scene: a step slots in above `run`, then a step is edited. */
import type { HeroArg, HeroCommand } from './types'
import { type Clock, EASE, GLIDE_MS, chevron, el, find, findAll, flipMove, play } from './dom'

export function stepNode(n: number, pt: HeroArg, value: string): HTMLElement {
  const step = pt.step ?? { keyword: '', value: '' }
  const node = el(
    'div',
    `hero-step hero-k${pt.colour}${step.run ? ' run' : ''} slot`,
    el('span', 'hero-step-no', step.run ? play() : String(n)),
    el('span', 'hero-step-grip', '='),
    el('span', 'hero-step-pill', step.keyword),
    el('span', 'hero-step-val', value),
    el('span', 'hero-step-chev', chevron()),
  )
  return node
}

/** A step slots in above `run` and the command opens a row for it; then a step is edited. */
export async function playChain(host: HTMLElement, h: HeroCommand, c: Clock) {
  const chain = find(host, '.hero-chain')
  const cmd = find(host, '.hero-cmd')
  const run = find(chain, '.hero-step.run')
  const lateIndex = h.parts.findIndex((p) => p.kind === 'arg' && p.late)
  const late = h.parts[lateIndex]
  const part = findAll(cmd, '.hp')[lateIndex]
  if (late?.kind === 'arg' && part) {
    const tile = stepNode(4, late, late.step?.value ?? '')
    tile.classList.add('work')
    find(part, '.hp-vt').textContent = late.value
    // One FLIP over both sides: on a phone the chain sits below the command and moves too.
    flipMove(
      [...findAll(chain, '.hero-step'), ...findAll(cmd, '.hp').filter((p) => p !== part)],
      () => {
        chain.insertBefore(tile, run)
        part.classList.remove('wait')
      },
      c.fast,
    )
    find(run, '.hero-step-no').replaceChildren(play())
    part.classList.add('hot')
    if (!c.fast) {
      part.animate(
        [
          { transform: 'translateX(80px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: GLIDE_MS, easing: EASE },
      )
    }
    await c.wait(40)
    tile.classList.remove('slot')
    await c.wait(1800)
    tile.classList.remove('work')
  }
  // The first step is worked on, and the command follows it letter by letter.
  const firstIndex = h.parts.findIndex((p) => p.kind === 'arg')
  const firstPart = h.parts[firstIndex]
  const first = find(chain, '.hero-step')
  const left = findAll(cmd, '.hp')[firstIndex]
  if (firstPart?.kind !== 'arg' || !firstPart.append || !left) return
  const extra = firstPart.append
  const value = find(first, '.hero-step-val')
  const leftText = find(left, '.hp-vt')
  first.classList.add('work')
  await c.wait(500)
  for (let i = 1; i <= extra.length; i++) {
    value.textContent = (firstPart.step?.value ?? '') + extra.slice(0, i)
    flipMove(
      findAll(cmd, '.hp').filter((p) => p !== left),
      () => leftText.replaceChildren(firstPart.value, el('span', 'hero-hot', extra.slice(0, i))),
      c.fast,
      140,
      'ease-out',
    )
    await c.wait(110)
  }
  await c.wait(1200)
  first.classList.remove('work')
  leftText.textContent = firstPart.value + extra
}
