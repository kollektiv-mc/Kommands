import {
  KIND_LABELS,
  MODIFIER_DEFAULTS,
  SHAPE_DEFAULTS,
  type GroupLayer,
  type Layer,
  type ModifierKind,
  type ModifierLayer,
  type ModifierParams,
  type Op,
  type ReferenceLayer,
  type ShapeKind,
  type ShapeLayer,
  type ShapeParams,
  type Vec3,
} from './layers'

/**
 * New layers, with their defaults.
 *
 * Ids only have to be unique within one document, but a document outlives the session
 * that made it and a layer pasted or duplicated into it must not collide with one saved
 * last week. So each session takes a random prefix and counts from there, which keeps
 * ids short enough to read in a test failure.
 */
const SESSION = Math.floor(Math.random() * 36 ** 4).toString(36)
let counter = 0
export const newId = (): string => `${SESSION}${(++counter).toString(36)}`

const ORIGIN: Vec3 = [0, 0, 0]
const UNIT: Vec3 = [1, 1, 1]

interface Placement {
  name?: string
  pos?: Vec3
  rot?: Vec3
  scl?: Vec3
}

export function shape<K extends ShapeKind>(
  kind: K,
  options: Placement & { op?: Op; params?: Partial<ShapeParams[K]> } = {},
): ShapeLayer {
  return {
    id: newId(),
    type: 'shape',
    kind,
    name: options.name ?? KIND_LABELS[kind],
    op: options.op ?? (kind === 'half' ? 'cut' : kind === 'gyroid' ? 'overlap' : 'add'),
    visible: true,
    pos: options.pos ?? ORIGIN,
    rot: options.rot ?? ORIGIN,
    scl: options.scl ?? UNIT,
    params: { ...SHAPE_DEFAULTS[kind], ...options.params },
  } as ShapeLayer
}

export function modifier<K extends ModifierKind>(
  kind: K,
  options: Omit<Placement, 'scl'> & { params?: Partial<ModifierParams[K]> } = {},
): ModifierLayer {
  return {
    id: newId(),
    type: 'modifier',
    kind,
    name: options.name ?? KIND_LABELS[kind],
    visible: true,
    pos: options.pos ?? ORIGIN,
    rot: options.rot ?? ORIGIN,
    scl: UNIT,
    params: { ...MODIFIER_DEFAULTS[kind], ...options.params },
  } as ModifierLayer
}

export function group(
  children: readonly Layer[],
  options: Placement & { op?: Op; open?: boolean } = {},
): GroupLayer {
  return {
    id: newId(),
    type: 'group',
    name: options.name ?? KIND_LABELS.group,
    op: options.op ?? 'add',
    visible: true,
    open: options.open ?? true,
    pos: options.pos ?? ORIGIN,
    rot: options.rot ?? ORIGIN,
    scl: options.scl ?? UNIT,
    children,
  }
}

export function reference(
  options: Placement & { command?: string; template?: string } = {},
): ReferenceLayer {
  return {
    id: newId(),
    type: 'reference',
    name: options.name ?? KIND_LABELS.reference,
    visible: true,
    pos: options.pos ?? ORIGIN,
    rot: options.rot ?? ORIGIN,
    scl: options.scl ?? UNIT,
    command: options.command ?? '',
    ...(options.template === undefined ? {} : { template: options.template }),
  }
}

/** A layer and everything in it with fresh ids, for Duplicate and for a template used twice. */
export function withFreshIds<T extends Layer>(layer: T): T {
  if (layer.type !== 'group') return { ...layer, id: newId() }
  return { ...layer, id: newId(), children: layer.children.map(withFreshIds) }
}
