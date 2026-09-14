import type { CommandValue } from '../schema/serialize'

/**
 * Undo/redo over the value tree.
 *
 * A pure module beside the store rather than logic inside it, so the coalescing rule
 * below is testable without mounting React or driving a component. Konnekt's
 * `frontend/src/tiles/scheduler/editor/graphHistory.ts` is the same shape over a
 * different snapshot, and the tag behaviour is copied from it deliberately: it is the
 * part that is easy to get subtly wrong and unpleasant to use when it is.
 *
 * What it snapshots is the whole `CommandValue`. That is affordable here in a way it
 * would not be in a graph editor: the tree is five records of primitives keyed by
 * path, so a snapshot is a shallow object of shallow objects, and the store already
 * replaces the tables it changes rather than mutating them. There is nothing to clone.
 */
export interface HistoryState {
  past: readonly CommandValue[]
  future: readonly CommandValue[]
  /**
   * The tag of the most recent `record`, or null after a structural change.
   *
   * Held here rather than derived, because coalescing is a fact about the *burst* that
   * produced an entry and not about the entry itself. Two separate visits to the same
   * field are two undo steps; the keystrokes within one visit are one.
   */
  lastTag: string | null
}

/**
 * How many steps back the editor remembers.
 *
 * Higher than Konnekt's ten because a snapshot costs less here. Its entries hold node
 * arrays with positions and edges; these hold a handful of string keys, so the cap is
 * about bounding growth over a long session rather than about the size of a step.
 */
export const MAX_HISTORY = 50

export function emptyHistory(): HistoryState {
  return { past: [], future: [], lastTag: null }
}

/**
 * Record the **pre-mutation** snapshot, ahead of the change that supersedes it.
 *
 * Consecutive calls carrying the same non-null tag collapse into the entry pushed by
 * the first call in the burst, so typing into one field is one undo step rather than
 * one per character. An untagged call always pushes and clears the tag, so a
 * structural change ends the burst and the next one starts over.
 *
 * Taking any new action clears `future`: redo is only meaningful immediately after an
 * undo, and a redo stack that survived an edit would restore a tree that never
 * followed from the one on screen.
 */
export function record(
  state: HistoryState,
  snapshot: CommandValue,
  tag: string | null = null,
): HistoryState {
  if (tag !== null && tag === state.lastTag) return state
  const past = [...state.past, snapshot]
  // Oldest first, so the cap drops the step furthest from what the user is doing.
  while (past.length > MAX_HISTORY) past.shift()
  return { past, future: [], lastTag: tag }
}

/**
 * Step back one entry, handing `current` to the redo stack.
 *
 * Null rather than an unchanged state when there is nothing to undo, so a caller
 * cannot quietly treat "nothing happened" as a step that happened.
 */
export function undo(
  state: HistoryState,
  current: CommandValue,
): { state: HistoryState; snapshot: CommandValue } | null {
  const snapshot = state.past[state.past.length - 1]
  if (snapshot === undefined) return null
  return {
    state: { past: state.past.slice(0, -1), future: [...state.future, current], lastTag: null },
    snapshot,
  }
}

/** Step forward one entry, handing `current` back to the undo stack. */
export function redo(
  state: HistoryState,
  current: CommandValue,
): { state: HistoryState; snapshot: CommandValue } | null {
  const snapshot = state.future[state.future.length - 1]
  if (snapshot === undefined) return null
  const past = [...state.past, current]
  while (past.length > MAX_HISTORY) past.shift()
  return { state: { past, future: state.future.slice(0, -1), lastTag: null }, snapshot }
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0
}
