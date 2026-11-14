import { describe, expect, test } from 'vitest'
import generated from '../generated/1.21.1/registries.json'
import { BLOCK_COLOURS } from './block-colours'
import { TEMPLATES, type LayerSpec } from './generate'

const blocks = new Set(generated.registries.block)

describe('block colours', () => {
  test('every id is a 1.21.1 block', () => {
    expect(Object.keys(BLOCK_COLOURS).filter((id) => !blocks.has(id))).toEqual([])
  })

  test('every template block has a colour', () => {
    const named = TEMPLATES.flatMap((t) => [...blocksIn(t.pattern), ...partBlocks(t.layers)])
    expect(named.filter((id) => !(id in BLOCK_COLOURS))).toEqual([])
  })
})

function blocksIn(pattern: string): string[] {
  return pattern.split(',').map((part) => part.replace(/^[0-9.]+%/, '').trim())
}

/** The blocks a template's other parts are in: each part is a Reference in a block of its own. */
function partBlocks(layers: readonly LayerSpec[]): string[] {
  return layers.flatMap((spec) => {
    if ('part' in spec) return [...blocksIn(spec.block), ...partBlocks(spec.part)]
    if ('group' in spec) return partBlocks(spec.group)
    return []
  })
}
