import { create } from 'zustand'
import {
  createSaved,
  renameSaved,
  reviseSaved,
  type SavedCommand,
  type SavedCommandDraft,
} from '../schema/saved'
import { resolveStorage, type SavedCommandStorage } from '../storage'

/**
 * Whether saving is available, and whether the list has been read yet.
 *
 * `unavailable` is a first-class state rather than an error, because it is reachable
 * without anything going wrong: a browser refusing site data has no storage to offer,
 * and the generator itself works perfectly well without one.
 */
export type SavedStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

interface SavedCommandsState {
  commands: readonly SavedCommand[]
  status: SavedStatus
  /**
   * The last write that failed, if one did.
   *
   * Held rather than thrown because every caller here is an event handler, and an
   * unhandled rejection out of a click is invisible to the user. A quota-exceeded save
   * has to become something the UI can say.
   */
  error: string | null
  /** Read the backend. Safe to call more than once; the second call re-reads. */
  load: () => Promise<void>
  /** Save a command that has never been saved. Resolves to its new, permanent id. */
  create: (draft: SavedCommandDraft) => Promise<string | null>
  /** Replace a saved command's content, bumping its revision. */
  revise: (id: string, content: Pick<SavedCommandDraft, 'value' | 'preview'>) => Promise<void>
  /** Rename without bumping the revision — see `SavedCommand.revision`. */
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

/**
 * Where the store writes.
 *
 * Resolved once, lazily, and cached — `resolveStorage` touches `window.localStorage`,
 * which throws in a browser refusing site data, so calling it per action would pay
 * that cost repeatedly and calling it at module scope would run it during import in
 * every test that touches this file.
 *
 * `configureStorage` exists for tests, which need a backend that is neither the real
 * `localStorage` nor a mock of the module. Handing one in beats spying on an import:
 * the store then exercises the same code path production does, against storage the
 * test owns.
 */
let backend: SavedCommandStorage | null | undefined
function storage(): SavedCommandStorage | null {
  if (backend === undefined) backend = resolveStorage()
  return backend
}

export function configureStorage(override: SavedCommandStorage | null | undefined): void {
  backend = override
}

/** The message an unknown thrown value reports as. */
function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useSavedCommandsStore = create<SavedCommandsState>((set, get) => ({
  commands: [],
  status: 'idle',
  error: null,

  load: async () => {
    const store = storage()
    if (!store) return set({ status: 'unavailable', commands: [] })
    set({ status: 'loading' })
    try {
      const commands = await store.list()
      // Newest first. The order is decided here rather than by the backend because it
      // is a presentation question, and a file backend has no reason to answer it the
      // same way `localStorage` does.
      //
      // The tiebreak on id is not decoration. `updatedAt` is millisecond-resolution
      // ISO, and two commands saved in the same millisecond is not a hypothetical —
      // it happens whenever anything saves twice in a row without a user between the
      // two. Without a tiebreak those two sort by whatever order the backend happened
      // to return, which differs between backends and can differ between reads of the
      // same one, so a dashboard would reshuffle for no visible reason. The id is
      // arbitrary but permanent, which is the whole requirement.
      set({
        commands: [...commands].sort(
          (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
        ),
        status: 'ready',
        error: null,
      })
    } catch (error) {
      set({ status: 'ready', commands: [], error: reason(error) })
    }
  },

  create: async (draft) => {
    const store = storage()
    if (!store) {
      set({ status: 'unavailable' })
      return null
    }
    const saved = createSaved(draft)
    try {
      await store.put(saved)
    } catch (error) {
      // Not added to `commands`. A tile for a command that is not on disk would
      // survive exactly until the next reload, and the user would have no way to know
      // which of their saved commands were real.
      set({ error: reason(error) })
      return null
    }
    set((s) => ({ commands: [saved, ...s.commands], status: 'ready', error: null }))
    return saved.id
  },

  revise: async (id, content) => {
    const store = storage()
    const existing = get().commands.find((held) => held.id === id)
    if (!store || !existing) return
    const next = reviseSaved(existing, content)
    try {
      await store.put(next)
    } catch (error) {
      return set({ error: reason(error) })
    }
    set((s) => ({
      commands: s.commands.map((held) => (held.id === id ? next : held)),
      error: null,
    }))
  },

  rename: async (id, name) => {
    const store = storage()
    const existing = get().commands.find((held) => held.id === id)
    if (!store || !existing) return
    const next = renameSaved(existing, name)
    try {
      await store.put(next)
    } catch (error) {
      return set({ error: reason(error) })
    }
    set((s) => ({
      commands: s.commands.map((held) => (held.id === id ? next : held)),
      error: null,
    }))
  },

  remove: async (id) => {
    const store = storage()
    if (!store) return
    try {
      await store.remove(id)
    } catch (error) {
      return set({ error: reason(error) })
    }
    set((s) => ({ commands: s.commands.filter((held) => held.id !== id), error: null }))
  },
}))
