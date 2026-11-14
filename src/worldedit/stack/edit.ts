import { rotation, tidy } from './affine'
import { actsBelow, type GroupLayer, type Layer, type Vec3 } from './layers'
import { group, withFreshIds } from './make'

/**
 * Edits to a layer stack, each one a new stack.
 *
 * Plain functions over plain data, so the store's undo is a list of earlier values and a
 * test needs no store at all. An id that is not in the stack leaves it as it was.
 */

export interface Found {
  layer: Layer
  /** The list it sits in. */
  list: readonly Layer[]
  index: number
  /** The groups it sits inside, outermost first. */
  parents: readonly GroupLayer[]
}

export function find(layers: readonly Layer[], id: string): Found | null {
  const visit = (list: readonly Layer[], parents: readonly GroupLayer[]): Found | null => {
    for (let index = 0; index < list.length; index++) {
      const layer = list[index]!
      if (layer.id === id) return { layer, list, index, parents }
      if (layer.type === 'group') {
        const inner = visit(layer.children, [...parents, layer])
        if (inner) return inner
      }
    }
    return null
  }
  return visit(layers, [])
}

export function* eachLayer(layers: readonly Layer[]): Generator<Layer> {
  for (const layer of layers) {
    yield layer
    if (layer.type === 'group') yield* eachLayer(layer.children)
  }
}

/** Every list in the stack rebuilt by `edit`, innermost first. */
function mapLists(
  layers: readonly Layer[],
  edit: (list: readonly Layer[]) => readonly Layer[],
): readonly Layer[] {
  const inner = layers.map((layer) =>
    layer.type === 'group' ? { ...layer, children: mapLists(layer.children, edit) } : layer,
  )
  return edit(inner)
}

export function update(layers: readonly Layer[], id: string, change: (layer: Layer) => Layer) {
  return mapLists(layers, (list) => list.map((layer) => (layer.id === id ? change(layer) : layer)))
}

export function remove(layers: readonly Layer[], id: string): readonly Layer[] {
  return mapLists(layers, (list) => list.filter((layer) => layer.id !== id))
}

/** Where a layer goes: a position in a group's list, or in the top list for `null`. */
export interface Slot {
  parent: string | null
  index: number
}

export function insert(layers: readonly Layer[], layer: Layer, slot: Slot): readonly Layer[] {
  const into = (list: readonly Layer[]): Layer[] => {
    const index = Math.max(0, Math.min(slot.index, list.length))
    return [...list.slice(0, index), layer, ...list.slice(index)]
  }
  if (slot.parent === null) return into(layers)
  return update(layers, slot.parent, (target) =>
    target.type === 'group' ? { ...target, open: true, children: into(target.children) } : target,
  )
}

/**
 * Where the palette puts a new layer, given what is selected.
 *
 * A modifier or a Half goes above the selection, because it acts on what is below it. Any
 * other layer goes into a selected group, at its end, or below a selected layer, and with
 * nothing selected at the end of the top list.
 */
export function slotFor(layers: readonly Layer[], layer: Layer, selected: string | null): Slot {
  const at = selected === null ? null : find(layers, selected)
  const parent = at?.parents.at(-1)?.id ?? null
  if (actsBelow(layer)) return at ? { parent, index: at.index } : { parent: null, index: 0 }
  if (at?.layer.type === 'group') return { parent: at.layer.id, index: at.layer.children.length }
  return at ? { parent, index: at.index + 1 } : { parent: null, index: layers.length }
}

/**
 * Move a layer to a slot. The slot's index is read in the list as it is before the move,
 * which is what a drop indicator between two rows shows. Dropping a group into itself
 * does nothing.
 */
export function move(layers: readonly Layer[], id: string, slot: Slot): readonly Layer[] {
  const from = find(layers, id)
  if (!from) return layers
  if (slot.parent !== null) {
    const target = find(layers, slot.parent)
    if (!target || target.layer.id === id || target.parents.some((g) => g.id === id)) return layers
  }
  const sameList = (from.parents.at(-1)?.id ?? null) === slot.parent
  const index = sameList && slot.index > from.index ? slot.index - 1 : slot.index
  return insert(remove(layers, id), from.layer, { parent: slot.parent, index })
}

/** A copy just below the original, nudged so it can be seen, with fresh ids throughout. */
export function duplicate(
  layers: readonly Layer[],
  id: string,
): { layers: readonly Layer[]; id: string | null } {
  const at = find(layers, id)
  if (!at) return { layers, id: null }
  const [x, y, z] = at.layer.pos
  const copy: Layer = {
    ...withFreshIds(at.layer),
    name: `${at.layer.name} copy`,
    pos: [tidy(x + 0.1), y, tidy(z + 0.1)],
  }
  const parent = at.parents.at(-1)?.id ?? null
  return { layers: insert(layers, copy, { parent, index: at.index + 1 }), id: copy.id }
}

/** The layer inside a new group in its place. The group takes over how it combines. */
export function wrap(
  layers: readonly Layer[],
  id: string,
): { layers: readonly Layer[]; id: string | null } {
  const at = find(layers, id)
  if (!at) return { layers, id: null }
  const { layer } = at
  const op = layer.type === 'shape' || layer.type === 'group' ? layer.op : 'add'
  const outer = group([withOp(layer)], { op })
  return { layers: update(layers, id, () => outer), id: outer.id }
}

/**
 * The group's children in its place, each carrying the group's placement so nothing
 * moves. What the group clipped to its own box is no longer clipped, and a non-uniform
 * scale over a turned child cannot be written as a placement, so that child is given the
 * nearest one: both are what ungrouping means, and the result is visible straight away.
 */
export function ungroup(
  layers: readonly Layer[],
  id: string,
): { layers: readonly Layer[]; id: string | null } {
  const at = find(layers, id)
  if (!at || at.layer.type !== 'group') return { layers, id: null }
  const outer = at.layer
  const children = outer.children.map((child): Layer => {
    const placement = composed(outer, child)
    // A modifier moves and turns but never scales.
    return child.type === 'modifier'
      ? { ...child, ...placement, scl: child.scl }
      : { ...child, ...placement }
  })
  const first = children[0]
  if (
    first &&
    outer.op !== 'add' &&
    (first.type === 'shape' || first.type === 'group') &&
    first.op === 'add'
  ) {
    children[0] = { ...first, op: outer.op }
  }
  const result = mapLists(layers, (list) =>
    list.flatMap((layer) => (layer.id === id ? children : [layer])),
  )
  return { layers: result, id: first?.id ?? null }
}

type Matrix = readonly number[]
interface Placement {
  pos: Vec3
  rot: Vec3
  scl: Vec3
}

/** `T·R·S` as a row-major 3×3 and a translation. */
function matrixOf({ rot, scl }: Placement): Matrix {
  const r = rotation(rot)
  return r.map((v, i) => v * scl[i % 3]!)
}

function composed(outer: Placement, inner: Placement): Placement {
  const g = matrixOf(outer)
  const c = matrixOf(inner)
  const m = [0, 1, 2].flatMap((r) =>
    [0, 1, 2].map((k) => g[r * 3]! * c[k]! + g[r * 3 + 1]! * c[3 + k]! + g[r * 3 + 2]! * c[6 + k]!),
  )
  const pos = [0, 1, 2].map(
    (r) =>
      outer.pos[r]! +
      g[r * 3]! * inner.pos[0] +
      g[r * 3 + 1]! * inner.pos[1] +
      g[r * 3 + 2]! * inner.pos[2],
  )
  // Each column's length is that axis's scale; what is left is the turn.
  const scl = [0, 1, 2].map((k) => Math.hypot(m[k]!, m[3 + k]!, m[6 + k]!))
  const at = (r: number, k: number): number => m[r * 3 + k]! / scl[k]!
  const y = Math.asin(Math.max(-1, Math.min(1, at(0, 2))))
  const flat = Math.abs(at(0, 2)) < 0.9999999
  const x = flat ? Math.atan2(-at(1, 2), at(2, 2)) : Math.atan2(at(2, 1), at(1, 1))
  const z = flat ? Math.atan2(-at(0, 1), at(0, 0)) : 0
  const degrees = (radians: number): number => Number(((radians * 180) / Math.PI).toFixed(6)) || 0
  return {
    pos: [tidy(pos[0]!), tidy(pos[1]!), tidy(pos[2]!)],
    rot: [degrees(x), degrees(y), degrees(z)],
    scl: [tidy(scl[0]!), tidy(scl[1]!), tidy(scl[2]!)],
  }
}

/**
 * Layers that change nothing, and why: a modifier or Half with no shape below it, and a
 * Cut or Overlap with nothing added above it. The list marks them rather than hiding
 * them, since a layer that is idle now may not be after the next drag.
 */
export function idleLayers(layers: readonly Layer[]): Map<string, string> {
  const idle = new Map<string, string>()
  const mark = (list: readonly Layer[]): void => {
    let base = false
    list.forEach((layer, i) => {
      if (layer.type === 'group') mark(layer.children)
      if (!layer.visible || layer.type === 'reference') return
      if (actsBelow(layer)) {
        const below = list.slice(i + 1)
        if (!below.some((b) => b.visible && b.type !== 'reference' && !actsBelow(b))) {
          idle.set(layer.id, 'Nothing below it to change')
        }
        return
      }
      if (layer.op === 'add') base = true
      else if (!base) {
        idle.set(
          layer.id,
          layer.op === 'cut' ? 'Nothing above it to cut from' : 'Nothing above it to overlap',
        )
      }
    })
  }
  mark(layers)
  return idle
}

/**
 * The stack with only one layer showing, for S. The layer stays inside its groups, so it
 * keeps their placement; a modifier keeps the layers it acts on.
 */
export function isolated(layers: readonly Layer[], id: string): readonly Layer[] | null {
  const at = find(layers, id)
  if (!at) return null
  const { layer } = at
  let inner: readonly Layer[] = actsBelow(layer)
    ? [{ ...layer, visible: true }, ...at.list.slice(at.index + 1)]
    : [withOp({ ...layer, visible: true })]
  for (const parent of [...at.parents].reverse())
    inner = [{ ...parent, op: 'add', visible: true, children: inner }]
  return inner
}

const withOp = (layer: Layer): Layer =>
  layer.type === 'shape' || layer.type === 'group' ? { ...layer, op: 'add' } : layer
