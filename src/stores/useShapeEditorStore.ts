import { create } from 'zustand'
import { DEFAULT_PATTERN, type TemplateSpec } from '../data/authored/generate'
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

/** How the view draws the build. A way of looking, so never part of the document or undo. */
export interface ViewOptions {
  /** The blocks the command places, or the shapes it is built from. */
  show: 'blocks' | 'shapes'
  shading: 'coloured' | 'solid' | 'wire'
  /** Hide the half of the build nearer the camera. */
  cutaway: boolean
  /** See-through blocks. */
  xray: boolean
  bounds: boolean
  grid: boolean
  axes: boolean
  /** A player standing beside the build, to scale. */
  player: boolean
}

export const DEFAULT_VIEW: ViewOptions = {
  show: 'blocks',
  shading: 'coloured',
  cutaway: false,
  xray: false,
  bounds: true,
  grid: true,
  axes: true,
  player: false,
}

/**
 * Edit mode and its gizmo. View mode orbits and selects; Edit adds the move, turn and
 * scale gizmo on the selected layer. Like the view, never part of the document.
 */
export interface EditOptions {
  on: boolean
  mode: 'translate' | 'rotate' | 'scale'
  snap: boolean
  /** Moves snap to round steps, or to the preview's block centres. */
  snapTo: 'grid' | 'blocks'
  /** The snap steps: a move in units, a turn in degrees, a scale as a factor. */
  move: number
  turn: number
  scale: number
}

export const DEFAULT_EDIT: EditOptions = {
  on: false,
  mode: 'translate',
  snap: true,
  snapTo: 'grid',
  move: 0.05,
  turn: 15,
  scale: 0.05,
}

interface ShapeEditorState extends ShapeSnapshot {
  selected: string | null
  /** The layer S shows on its own, or null. */
  isolate: string | null
  history: HistoryState<ShapeSnapshot>
  view: ViewOptions
  edit: EditOptions
  /** A gizmo drag is under way, which Escape leaves alone. */
  dragging: boolean
  /** The last Find: which layer the view frames, or the whole selection; `n` counts asks. */
  finding: { id: string | null; n: number }

  load: (snapshot: ShapeSnapshot) => void
  select: (id: string | null) => void
  setIsolate: (id: string | null) => void
  setView: (change: Partial<ViewOptions>) => void
  setEdit: (change: Partial<EditOptions>) => void
  setDragging: (dragging: boolean) => void
  /** Frame a layer in the view, or the whole selection for null. */
  findLayer: (id: string | null) => void

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

export const snapshotOf = (s: ShapeSnapshot): ShapeSnapshot => ({
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
    pattern: DEFAULT_PATTERN,
    hollow: false,
    round: false,
    selected: null,
    isolate: null,
    history: emptyHistory<ShapeSnapshot>(),
    view: DEFAULT_VIEW,
    edit: DEFAULT_EDIT,
    dragging: false,
    finding: { id: null, n: 0 },

    load: (snapshot) =>
      set({ ...snapshot, selected: null, isolate: null, history: emptyHistory<ShapeSnapshot>() }),
    select: (id) => {
      const { isolate, layers } = get()
      // Picking something outside the isolated layer ends the isolation.
      const outside = isolate !== null && id !== null && !isInside(layers, isolate, id)
      set(outside ? { selected: id, isolate: null } : { selected: id })
    },
    setIsolate: (id) => set({ isolate: id }),
    setView: (change) => set((s) => ({ view: { ...s.view, ...change } })),
    setEdit: (change) => set((s) => ({ edit: { ...s.edit, ...change } })),
    setDragging: (dragging) => set({ dragging }),
    findLayer: (id) => set((s) => ({ finding: { id, n: s.finding.n + 1 } })),

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
