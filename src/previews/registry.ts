import type { PreviewModule } from './types'
import { shapePreview } from './worldedit/shape'

/**
 * Every preview module the app knows about.
 *
 * Eager, and deliberately so: the abstraction is eager and the code is lazy. What is
 * held here is a descriptor — an id, a `load` thunk and an `accepts` predicate — none
 * of which reaches a single line of Three.js. `docs/architecture.md` § Previews is the
 * claim; this file is where it either holds or does not.
 *
 * Shaped like `LOADERS` in `src/data/loadGenerated.ts` for the same reason: one place
 * that names what can be loaded, and nothing importing the payload directly.
 */
const MODULES: readonly PreviewModule[] = [shapePreview]

const REGISTRY = new Map<string, PreviewModule>(MODULES.map((m) => [m.id, m]))

export function previewModule(id: string): PreviewModule | undefined {
  return REGISTRY.get(id)
}

/** Every registered id. Used by the binding check to say what a typo could have meant. */
export function registeredPreviewIds(): string[] {
  return [...REGISTRY.keys()]
}
