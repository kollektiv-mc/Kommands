import { describe, expect, test } from 'vitest'
import { TEMPLATES } from '../../data/authored/generate'
import { compileExpression } from '../expression'
import { eachLayer } from './edit'
import { partCommand, templateLayers } from './templates'

/** Every command a template writes: its own, then each part's. */
function commands(template: (typeof TEMPLATES)[number]): string[] {
  const layers = templateLayers(template)
  const own = partCommand(template.pattern, layers)
  const parts = [...eachLayer(layers)].flatMap((l) => (l.type === 'reference' ? [l.command] : []))
  return [own, ...parts]
}

const expressionOf = (command: string): string => command.split(' ').slice(2).join(' ')

/** Whether any block in the selection's bottom layer is filled, at `size` blocks a side. */
function touchesFloor(sources: readonly string[], size: number): boolean {
  const step = 2 / (size - 1)
  return sources.some((source) => {
    const compiled = compileExpression(source)
    if (!compiled.ok) return false
    for (let i = 0; i < size; i++) {
      for (let k = 0; k < size; k++) {
        if (compiled.expression.evaluate(-1 + i * step, -1, -1 + k * step) > 0) return true
      }
    }
    return false
  })
}

describe('templates', () => {
  test('there are eight, each with a name and a pattern', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      'planet',
      'arch',
      'roots',
      'colonnade',
      'tree',
      'tower',
      'gyroid',
      'spire',
    ])
    for (const t of TEMPLATES) expect(t.pattern.length).toBeGreaterThan(0)
  })

  test.each(TEMPLATES.map((t) => [t.id, t] as const))('%s writes commands that parse', (_, t) => {
    for (const command of commands(t)) {
      expect(compileExpression(expressionOf(command)).ok, command).toBe(true)
    }
  })

  test.each(TEMPLATES.map((t) => [t.id, t] as const))('%s stands on the floor', (_, t) => {
    const sources = commands(t).map(expressionOf)
    for (const size of [32, 64, 128]) expect(touchesFloor(sources, size), `${size}³`).toBe(true)
  })

  test('used twice, a template shares no ids', () => {
    const ids = [...eachLayer([...templateLayers(TEMPLATES[1]!), ...templateLayers(TEMPLATES[1]!)])]
    expect(new Set(ids.map((l) => l.id)).size).toBe(ids.length)
  })
})
