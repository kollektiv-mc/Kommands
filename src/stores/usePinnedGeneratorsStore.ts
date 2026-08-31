import { create } from 'zustand'
import {
  readPinnedGenerators,
  writePinnedGenerators,
  type PinnedGenerator,
} from '../storage/preferences'

interface PinnedGeneratorsState {
  pinned: readonly PinnedGenerator[]
  hydrated: boolean
  /** Read the stored pins. Safe to call repeatedly; only the first does work. */
  hydrate: () => void
  /** Pin a generator, or unpin it if it is already pinned. Idempotent per id. */
  toggle: (generator: PinnedGenerator) => void
  isPinned: (id: string) => boolean
}

/**
 * Which command generators are pinned to the dashboard.
 *
 * A **third** persisted thing, deliberately separate from both the saved commands and
 * the panel layout. Saved commands are user work with a cross-application format
 * (`persistence.md`); the panel layout is which lenses are on screen; this is a
 * shortlist of the eighty-odd generators the build offers. Merging any two of them
 * would give one store two lifetimes and one format two audiences.
 *
 * A pin is not a saved command and does not become one. `SavedCommand.pinned` already
 * exists and means something else entirely — "keep this *finished* command in Quick" —
 * and the two panels answer different questions: Quick is "a command I made and want
 * again", Pinned is "a command I make often and do not want to search for". Reusing
 * one flag for both would collapse that distinction the first time someone pinned a
 * generator they had never saved from.
 */
export const usePinnedGeneratorsStore = create<PinnedGeneratorsState>((set, get) => ({
  pinned: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    set({ pinned: readPinnedGenerators(), hydrated: true })
  },

  toggle: (generator) => {
    const held = get().pinned
    // Appended rather than sorted. The order is the order they were pinned in, which
    // is a fact; alphabetising would be a second opinion about a list the user built.
    const pinned = held.some((entry) => entry.id === generator.id)
      ? held.filter((entry) => entry.id !== generator.id)
      : [...held, generator]
    set({ pinned })
    writePinnedGenerators(pinned)
  },

  isPinned: (id) => get().pinned.some((entry) => entry.id === id),
}))
