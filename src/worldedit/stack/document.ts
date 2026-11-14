import {
  MODIFIER_DEFAULTS,
  MODIFIER_KINDS,
  SHAPE_DEFAULTS,
  SHAPE_KINDS,
  type Layer,
  type ModifierKind,
  type Op,
  type ShapeDocument,
  type ShapeKind,
  type Vec3,
} from './layers'

/**
 * A saved document read back, or nothing.
 *
 * The document travels inside a command's value (`we_expression`), so what arrives
 * here came from a file: a command saved by this editor, by an older one, or edited by
 * hand. Each layer is checked against the shape this build gives it, field by field,
 * and one that does not fit fails the whole document. The editor then opens the
 * command's text instead, which loses the layers but never the shape, where a partly
 * read stack would quietly be a different one.
 *
 * Params are checked against each kind's defaults: every field the kind has must be
 * there with the default's type, and the few that are a word must be one of its words.
 */
export function readDocument(value: unknown): ShapeDocument | null {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['layers'])) return null
  const ids = new Set<string>()
  const layers = readLayers(value['layers'], ids)
  if (layers === null) return null
  const round = value['round']
  if (round !== undefined && typeof round !== 'boolean') return null
  return round === undefined ? { version: 1, layers } : { version: 1, layers, round }
}

/** The words a word-valued param may hold. Anything not named here is a number. */
const WORDS: Readonly<Record<string, readonly string[]>> = {
  axis: ['x', 'y', 'z'],
  along: ['x', 'y', 'z'],
  toward: ['x', 'y', 'z'],
  side: ['+', '-', 'both'],
  type: ['wave', 'twist'],
}

const OPS: readonly Op[] = ['add', 'cut', 'overlap']
const SHAPES: readonly ShapeKind[] = [...SHAPE_KINDS, 'half']

function readLayers(list: readonly unknown[], ids: Set<string>): Layer[] | null {
  const out: Layer[] = []
  for (const item of list) {
    const layer = readLayer(item, ids)
    if (layer === null) return null
    out.push(layer)
  }
  return out
}

function readLayer(item: unknown, ids: Set<string>): Layer | null {
  if (!isRecord(item)) return null
  const { id, name, visible } = item
  const pos = vec3(item['pos'])
  const rot = vec3(item['rot'])
  const scl = vec3(item['scl'])
  if (typeof id !== 'string' || ids.has(id) || typeof name !== 'string') return null
  if (typeof visible !== 'boolean' || pos === null || rot === null || scl === null) return null
  ids.add(id)
  const placed = { id, name, visible, pos, rot, scl }
  const op = OPS.find((o) => o === item['op']) ?? null

  switch (item['type']) {
    case 'shape': {
      const kind = SHAPES.find((k) => k === item['kind']) ?? null
      const params = kind === null ? null : readParams(item['params'], SHAPE_DEFAULTS[kind])
      if (kind === null || params === null || op === null) return null
      return shapeOf(kind, { ...placed, type: 'shape', op }, params)
    }
    case 'modifier': {
      const kind = MODIFIER_KINDS.find((k) => k === item['kind']) ?? null
      const params = kind === null ? null : readParams(item['params'], MODIFIER_DEFAULTS[kind])
      if (kind === null || params === null) return null
      return modifierOf(kind, { ...placed, type: 'modifier' }, params)
    }
    case 'group': {
      const children = Array.isArray(item['children']) ? readLayers(item['children'], ids) : null
      if (children === null || op === null || typeof item['open'] !== 'boolean') return null
      return { ...placed, type: 'group', op, open: item['open'], children }
    }
    case 'reference': {
      const { command, template } = item
      if (typeof command !== 'string') return null
      if (template !== undefined && typeof template !== 'string') return null
      return template === undefined
        ? { ...placed, type: 'reference', command }
        : { ...placed, type: 'reference', command, template }
    }
    default:
      return null
  }
}

/**
 * The params, when every field the defaults have is present with the same type.
 *
 * Built from the defaults' keys, so a field this build does not know is dropped rather
 * than carried, and the result has exactly the defaults' shape.
 */
function readParams<P extends object>(value: unknown, defaults: P): P | null {
  if (!isRecord(value)) return null
  const out: Record<string, unknown> = {}
  for (const [key, fallback] of Object.entries(defaults)) {
    const held = value[key]
    if (typeof held !== typeof fallback) return null
    if (typeof held === 'number' && !Number.isFinite(held)) return null
    const words = WORDS[key]
    if (words !== undefined && typeof held === 'string' && !words.includes(held)) return null
    out[key] = held
  }
  return { ...defaults, ...out }
}

// The two below rebuild a layer from parts already checked against its kind. The
// assertion is the one place the checked params meet the kind they were checked for,
// which TypeScript cannot follow through a lookup keyed by a runtime kind.
function shapeOf(kind: ShapeKind, base: object, params: object): Layer {
  return { ...base, kind, params } as Layer
}

function modifierOf(kind: ModifierKind, base: object, params: object): Layer {
  return { ...base, kind, params } as Layer
}

function vec3(value: unknown): Vec3 | null {
  if (!Array.isArray(value) || value.length !== 3) return null
  const [a, b, c] = value
  if (![a, b, c].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  return [Number(a), Number(b), Number(c)]
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
