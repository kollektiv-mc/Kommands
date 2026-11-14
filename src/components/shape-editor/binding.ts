import { DEFAULT_PATTERN } from '../../data/authored/generate'
import { expressionSource, isDrawn } from '../../schema/argument-types/we-expression'
import {
  parsePattern,
  serializePattern,
  type PatternValue,
} from '../../schema/argument-types/we-pattern'
import type { ShapeSnapshot } from '../../stores/useShapeEditorStore'
import type { StackCommand } from '../../worldedit/stack/command'
import { readDocument } from '../../worldedit/stack/document'
import type { ShapeDocument } from '../../worldedit/stack/layers'
import { shape } from '../../worldedit/stack/make'

/**
 * Between the sheet's values and the editor's document.
 *
 * The editor reads and writes three of `//generate`'s inputs, by the selectors the
 * preview binding declares: the expression (with the layers it was drawn from), the
 * pattern, and `-h`. A command typed by hand opens as one Formula layer holding its
 * text, so nothing a user wrote is lost by opening the editor on it.
 */
export const INPUTS = { expression: 'expression', pattern: 'pattern', hollow: '-h' } as const

export function openSnapshot(values: Readonly<Record<string, unknown>>): ShapeSnapshot {
  const expression = values[INPUTS.expression]
  const document = isDrawn(expression) ? readDocument(expression.layers) : null
  const source = expressionSource(expression).trim()
  const pattern = values[INPUTS.pattern]
  return {
    layers:
      document?.layers ??
      (source === '' ? [] : [shape('formula', { name: 'Expression', params: { source } })]),
    pattern: isPattern(pattern) ? serializePattern(pattern) : '',
    hollow: values[INPUTS.hollow] === true,
    round: document?.round ?? false,
  }
}

/**
 * What Done writes back. The pattern is the one the command used, so an empty Blocks
 * field writes the default the editor's own command showed rather than nothing.
 */
export function doneValues(
  snapshot: ShapeSnapshot,
  command: StackCommand,
): Readonly<Record<string, unknown>> {
  const document: ShapeDocument = { version: 1, layers: snapshot.layers, round: snapshot.round }
  return {
    [INPUTS.expression]:
      snapshot.layers.length === 0 ? '' : { source: command.expression, layers: document },
    [INPUTS.pattern]: parsePattern(snapshot.pattern.trim() || DEFAULT_PATTERN),
    [INPUTS.hollow]: snapshot.hollow,
  }
}

function isPattern(value: unknown): value is PatternValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'entries' in value &&
    Array.isArray(value.entries)
  )
}
