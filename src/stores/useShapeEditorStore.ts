import { create } from 'zustand'
import type { TemplateSpec } from '../data/authored/generate'
import {
  duplicate,
  eachLayer,
  find,
  insert,
  isolated,
  move,
  remove,
  slotFor,
  ungroup,
  update,
  wrap,
  type Slot,
} from '../worldedit/stack/edit'
import type { Layer, Op } from '../worldedit/stack/layers'
import { templateLayers } from '../worldedit/stack/templates'
import { emptyHistory, record, redo, undo, type HistoryState } from './commandHistory'

/**
 * The //generate shape editor's document, selection and undo.
 *
 * One store for the one editor that is open at a time. The document is what the
 * command keeps: the layers, the pattern, Hollow and Round numbers. Selection, isolation and which
 * groups are open are not part of the shape and never enter undo, so undoing keeps the
 * current selection while it still exists.
 */

export interface ShapeSnapshot {
  layers: readonly Layer[]
  pattern: string
  hollow: boolean
  /** Round numbers: the command keeps four significant digits. */
  round: boolean
}

interface ShapeEditorState extends ShapeSnapshot {
  selected: string | null
  /** The layer S shows on its own, or null. */
  isolate: string | null
  history: HistoryState<ShapeSnapshot>

  load: (snapshot: ShapeSnapshot) => void
  select: (id: string | null) => void
  setIsolate: (id: string | null) => void

  /** Add a layer where the palette puts it, and select it. */
  add: (layer: Layer) => void
  applyTemplate: (template: TemplateSpec) => void
  /**
   * Change one layer. Calls with the same `tag` in a row are one undo step, so dragging
   * a value is one step rather than one per frame.
   */
  change: (id: string, edit: (layer: Layer) => Layer, tag?: string) => void
  /** End a burst of tagged changes, so the next one is an undo step of its own. */
  settle: () => void
  rename: (id: string, name: string) => void
  toggleVisible: (id: string) => void
  cycleOp: (id: string) => void
  /** Show or fold a group's children. Not part of the shape, so not an undo step. */
  toggleOpen: (id: string) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  wrapLayer: (id: string) => void
  ungroupLayer: (id: string) => void
  moveLayer: (id: string, slot: Slot) => void

  setPattern: (pattern: string, tag?: string) => void
  setHollow: (hollow: boolean) => void
  setRound: (round: boolean) => void

  undo: () => void
  redo: () => void
}

const NEXT_OP: Readonly<Record<Op, Op>> = { add: 'cut', cut: 'overlap', overlap: 'add' }

const snapshotOf = (s: ShapeSnapshot): ShapeSnapshot => ({
  layers: s.layers,
  pattern: s.pattern,
  hollow: s.hollow,
  round: s.round,
})

export const useShapeEditorStore = create<ShapeEditorState>((set, get) => {
  /** Apply a change to the document, recording what it was before. */
  const commit = (next: Partial<ShapeSnapshot> & { selected?: string | null }, tag?: string) => {
    const state = get()
    set({ ...next, history: record(state.history, snapshotOf(state), tag ?? null) })
  }
  const withLayers = (layers: readonly Layer[], selected?: string | null) => {
    commit(selected === undefined ? { layers } : { layers, selected })
  }
  /** After undo or redo: keep the selection if the layer is still there. */
  const restore = (snapshot: ShapeSnapshot, history: HistoryState<ShapeSnapshot>) => {
    const { selected, isolate } = get()
    const keep = (id: string | null) => (id !== null && find(snapshot.layers, id) ? id : null)
    set({ ...snapshot, history, selected: keep(selected), isolate: keep(isolate) })
  }

  return {
    layers: [],
    pattern: 'stone',
    hollow: false,
    round: false,
    selected: null,
    isolate: null,
    history: emptyHistory<ShapeSnapshot>(),

    load: (snapshot) =>
      set({ ...snapshot, selected: null, isolate: null, history: emptyHistory<ShapeSnapshot>() }),
    select: (id) => {
      const { isolate, layers } = get()
      // Picking something outside the isolated layer ends the isolation.
      const outside = isolate !== null && id !== null && !isInside(layers, isolate, id)
      set(outside ? { selected: id, isolate: null } : { selected: id })
    },
    setIsolate: (id) => set({ isolate: id }),

    add: (layer) => {
      const { layers, selected } = get()
      withLayers(insert(layers, layer, slotFor(layers, layer, selected)), layer.id)
    },
    applyTemplate: (template) => {
      const [outer] = templateLayers(template)
      if (outer) get().add(outer)
    },
    change: (id, edit, tag) => commit({ layers: update(get().layers, id, edit) }, tag),
    settle: () => set((s) => ({ history: { ...s.history, lastTag: null } })),
    rename: (id, name) => {
      const trimmed = name.trim()
      if (trimmed !== '') get().change(id, (l) => ({ ...l, name: trimmed }))
    },
    toggleVisible: (id) => get().change(id, (l) => ({ ...l, visible: !l.visible })),
    cycleOp: (id) =>
      get().change(id, (l) =>
        l.type === 'shape' || l.type === 'group' ? { ...l, op: NEXT_OP[l.op] } : l,
      ),
    toggleOpen: (id) =>
      set({
        layers: update(get().layers, id, (l) => (l.type === 'group' ? { ...l, open: !l.open } : l)),
      }),
    removeLayer: (id) => {
      const { layers, selected } = get()
      const next = remove(layers, id)
      withLayers(next, selected !== null && find(next, selected) ? selected : null)
    },
    duplicateLayer: (id) => {
      const result = duplicate(get().layers, id)
      if (result.id !== null) withLayers(result.layers, result.id)
    },
    wrapLayer: (id) => {
      const result = wrap(get().layers, id)
      if (result.id !== null) withLayers(result.layers, result.id)
    },
    ungroupLayer: (id) => {
      const result = ungroup(get().layers, id)
      if (result.layers !== get().layers) withLayers(result.layers, result.id)
    },
    moveLayer: (id, slot) => {
      const { layers } = get()
      const next = move(layers, id, slot)
      if (next !== layers) withLayers(next)
    },

    setPattern: (pattern, tag) => commit({ pattern }, tag),
    setHollow: (hollow) => commit({ hollow }),
    setRound: (round) => commit({ round }),

    undo: () => {
      const state = get()
      const step = undo(state.history, snapshotOf(state))
      if (step) restore(step.snapshot, step.state)
    },
    redo: () => {
      const state = get()
      const step = redo(state.history, snapshotOf(state))
      if (step) restore(step.snapshot, step.state)
    },
  }
})

/** Whether `id` is one of the layers isolating `isolate` shows. */
function isInside(layers: readonly Layer[], isolate: string, id: string): boolean {
  const view = isolated(layers, isolate)
  return view !== null && [...eachLayer(view)].some((layer) => layer.id === id)
}
