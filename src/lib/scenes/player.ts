/**
 * The download page's scenes, played in turn on one stage.
 *
 * Like the hero (`lib/hero/player.ts`), this is imperative DOM behind an empty React
 * host: the scenes move a cursor between windows and change what those windows show
 * at a pace no render cycle helps with. React owns the tabs; this owns the stage.
 *
 * Each scene cycles its variants: the Konnekt scene through Konnekt's layouts and its
 * Scheduler, the Saved commands scene through four commands. Every window leaves before
 * the next scene's arrive. Out of view, the clock pauses. Under reduced motion each
 * scene is shown finished and held, and a tab still switches between them.
 */
import { ABORT, clock, el, type Clock } from '../hero/dom'
import { SCENES } from '../../data/home/scenes'
import { playKonnekt } from './konnekt'
import { playSaved } from './saved'
import { closeAll, stage, STAGE_W, type Stage } from './stage'

const PLAYS: Record<(typeof SCENES)[number]['id'], (x: Stage, variant: number) => Promise<void>> = {
  konnekt: playKonnekt,
  saved: playSaved,
}

export interface ScenePlayer {
  /** Play from scene `i`, cutting the current one short. */
  jump: (i: number) => void
  stop: () => void
}

/**
 * Start the scenes in `host`. `onScene` is told which scene starts and how long it
 * will play, for the tab's progress bar.
 */
export function startScenes(
  host: HTMLElement,
  reduced: boolean,
  onScene: (i: number, ms: number) => void,
): ScenePlayer {
  const root = el('div', reduced ? 'sc-root still' : 'sc-root')
  host.append(root)
  const fit = () => {
    if (host.clientWidth) root.style.transform = `scale(${host.clientWidth / STAGE_W})`
  }
  const resize = new ResizeObserver(fit)
  resize.observe(host)
  fit()

  const variants = SCENES.map(() => 0)
  let current: Clock | null = null
  let visible = true
  const view = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting)
    if (current) current.paused = !visible
  })
  view.observe(host)

  async function loop(start: number) {
    if (current) current.aborted = true
    const c = clock(reduced)
    c.paused = !visible
    current = c
    let i = start
    try {
      await closeAll(root, c, 450)
      for (;;) {
        const scene = SCENES[i]
        onScene(i, scene.ms)
        const began = performance.now()
        await PLAYS[scene.id](stage(root, c), variants[i])
        variants[i]++
        if (c.fast) return
        await c.wait(Math.max(300, scene.ms - (performance.now() - began) - 600))
        await closeAll(root, c, 600)
        i = (i + 1) % SCENES.length
      }
    } catch (e) {
      if (e !== ABORT) throw e
    }
  }

  void loop(0)
  return {
    jump: (i) => void loop(i),
    stop() {
      if (current) current.aborted = true
      resize.disconnect()
      view.disconnect()
      root.remove()
    },
  }
}
