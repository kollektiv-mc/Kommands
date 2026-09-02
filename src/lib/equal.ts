/**
 * Structural equality for JSON-shaped values.
 *
 * It exists for one question — has this saved command's content actually changed? —
 * and the naive answers to that question are both wrong in the same direction. A
 * reference check says "changed" every time an editor rebuilds a tree, which is on
 * every keystroke. `JSON.stringify` comparison says "changed" whenever two equal
 * objects were built in a different key order, which is exactly what happens between a
 * tree assembled by the editor and the same tree read back out of storage: the
 * restored one carries the file's order, the edited one carries insertion order.
 *
 * Both failures are silent and both produce the bug this was written for — a revision
 * that climbs while the command stands still.
 *
 * **JSON-shaped is a real precondition, not a hedge.** A `CommandValue` round-trips
 * through `localStorage` or `store.json` by construction, so it holds objects, arrays,
 * strings, numbers, booleans and nulls and nothing else. A `Date`, a `Map` or a class
 * instance would compare as a plain object here and probably answer wrong; nothing can
 * put one into a value tree, and if something ever could, storage would lose it first.
 *
 * A key holding `undefined` is treated as absent, and that is load-bearing rather than
 * tidy: `JSON.stringify` drops such a key, so an in-memory tree with `{ x: undefined }`
 * and the same tree after a save-and-reload are the same tree, and a comparison that
 * called them different would bump a revision for having opened the command.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => sameValue(item, b[index]))
  }

  if (!isRecord(a) || !isRecord(b)) return false

  const keys = definedKeys(a)
  if (keys.length !== definedKeys(b).length) return false
  return keys.every((key) => sameValue(a[key], b[key]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The keys that survive a `JSON.stringify` — see the note about `undefined` above. */
function definedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => value[key] !== undefined)
}
