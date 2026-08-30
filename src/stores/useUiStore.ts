import { create } from 'zustand'

/** A rect, flattened. Enough to run a FLIP against, and nothing else. */
export interface OriginRect {
  top: number
  left: number
  width: number
  height: number
}

/** A rect, and what it was captured for. */
interface Origin {
  /**
   * What is about to be opened — the saved command's id.
   *
   * The rect is only meaningful for that one thing, and pairing them is what makes
   * reading pure. See `originFor`.
   */
  key: string
  rect: OriginRect | null
}

interface UiState {
  /**
   * Where the editor should appear to grow from, set by whatever opened it.
   *
   * Held here rather than in router state, for two reasons. A rect is a fact about
   * this paint — it is stale the moment anything scrolls, and history state outlives
   * the paint that produced it, so a back-navigation would replay a rect describing
   * where a tile *used* to be. And the editor is reachable by URL, where there is no
   * origin at all; a field that is simply absent then is more honest than one the
   * router would happily restore.
   *
   * Konnekt carries the same thing on its own `useUiStore` (`maximizeRequest`), for
   * the same reason.
   */
  origin: Origin | null
  /** Record where the editor is being opened from, then navigate. */
  openFrom: (key: string, rect: OriginRect | null) => void
  /**
   * The rect captured for `key`, or null.
   *
   * **A pure read.** It was a take-and-clear at first, and that was wrong in a way
   * only StrictMode showed: React double-invokes effects, so the first run consumed
   * the rect and the second — seeing nothing — re-ran the animation from the generic
   * fallback, overwriting the real one. Every tile-to-editor open played the wrong
   * animation, and nothing about it looked broken.
   *
   * Clearing on unmount instead does not help, because StrictMode's unmount happens
   * *between* the two mounts. The fix is not to find a safer moment to clear but to
   * stop needing one: keyed to what it was captured for, a stale rect is simply never
   * matched, so it can sit in the store until something replaces it. Opening a
   * different command, following a URL, or reloading all miss and fall back.
   */
  originFor: (key: string | undefined) => OriginRect | null
}

export const useUiStore = create<UiState>((set, get) => ({
  origin: null,
  openFrom: (key, rect) => set({ origin: { key, rect } }),
  originFor: (key) => {
    if (key === undefined) return null
    const held = get().origin
    return held && held.key === key ? held.rect : null
  },
}))

/** The rect of an element, in the flattened shape the store holds. */
export function originOf(element: Element | null): OriginRect | null {
  if (!element) return null
  const { top, left, width, height } = element.getBoundingClientRect()
  return { top, left, width, height }
}
