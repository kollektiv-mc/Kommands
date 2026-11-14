import { BLOCK_COLOURS } from '../../data/authored/block-colours'

/**
 * A block's colour as CSS, free of Three.js so the command bar's swatches can use it
 * without the view's chunk. `viewport/faces.ts` reads the same colour into the view.
 */

/** A namespaced id with states, and a `##` tag, both read as the bare id the table is keyed by. */
export function bareId(block: string): string {
  return block
    .trim()
    .replace(/\[.*$/, '')
    .replace(/^[#*^]+/, '')
    .split(':')
    .pop()!
}

/**
 * From the table, or for a block it does not list a muted one worked out from the id,
 * so the same block is always the same colour and two blocks rarely share one.
 */
export function blockCss(id: string): string {
  const known = BLOCK_COLOURS[id]
  if (known !== undefined) return known
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return `hsl(${hash % 360}, 28%, 52%)`
}
