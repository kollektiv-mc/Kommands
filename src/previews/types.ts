import type { ComponentType } from 'react'
import type { RegistryLookup } from '../data/versions/types'
import type { EditorOrigin } from '../lib/editorMotion'
import type { CommandDefinition, Diagnostic } from '../schema/types'

/**
 * What a preview module is, and what it is handed.
 *
 * The contract in `docs/adding-a-preview.md` is one sentence — **a module receives
 * parsed argument values, never the command string** — and these two types are the
 * whole of how it is enforced. There is no field here through which command text
 * could arrive, so a module that wanted to parse syntax would have to go and fetch
 * it, which is a visible thing to do rather than an accidental one.
 */

/**
 * What a module has to say about what it drew.
 *
 * Modules contribute **scene content only** — they render inside the `<Canvas>`, where
 * there is no DOM to put a sentence in. So the two things a module knows and the shell
 * does not travel back up through `report`: why there is nothing to draw, and what it
 * capped. Without this the module would have to own DOM chrome, and owning DOM chrome
 * is one short step from owning a renderer.
 */
export interface PreviewStatus {
  /** Why nothing is drawn, or what is being approximated. Rendered inline by the shell. */
  message?: string
  /** Warnings from whatever the module compiled. Shown, never blocking. */
  diagnostics?: readonly Diagnostic[]
  /**
   * The cap this module applied, in words.
   *
   * `docs/health-checklist.md` § 4 wants the cap **surfaced**, not merely applied: a
   * preview that quietly shrinks the shape is telling the user something false about
   * the command they are about to run.
   */
  cap?: string
}

export interface PreviewProps {
  /**
   * Parsed values for the declared `inputs`, keyed by the selector that named them.
   *
   * Keyed by selector rather than by bare name because a selector may be qualified —
   * `result/block/byte/scale` — and the module declared it in that spelling. `unknown`
   * because the value's shape is the argument type's business; a module narrows what
   * it declared in `accepts` and ignores the rest.
   */
  values: Readonly<Record<string, unknown>>
  /** The active version's registries, for resolving block and item ids. */
  registry: RegistryLookup
  /**
   * Report status to the shell, which owns every pixel of DOM around the canvas.
   *
   * Stable across renders, so a module may call it from an effect without the call
   * itself becoming a reason to run that effect again.
   */
  report: (status: PreviewStatus) => void
}

export interface PreviewModule {
  /** The key a definition's `preview.module` names. */
  id: string
  /**
   * The component, behind a dynamic import.
   *
   * This is the only thing keeping Three.js out of the entry chunk, so it is a
   * function returning `import()` rather than a component — the registry is eager and
   * everything it points at is not.
   */
  load: () => Promise<{ default: ComponentType<PreviewProps> }>
  /**
   * Whether this module can draw that definition, checked at build time.
   *
   * Assert argument **types**, not just names. Invariant 7 already proves every
   * `inputs` selector resolves to exactly one node; what it cannot know is whether that
   * node holds the kind of value the module reads. A module bound to an argument whose
   * type changed would otherwise render an empty canvas in production instead of
   * failing CI.
   */
  accepts: (definition: CommandDefinition) => boolean
  /**
   * A full-screen editor for what this module draws, behind its own dynamic import.
   *
   * Optional, and the only way a command gets an editor of its own: the sheet offers
   * Open editor on the preview of a module that has one, and nothing about the
   * renderer or the definition changes. The editor reads and writes the same inputs
   * the preview reads, so the binding that names them is checked once, by invariant 7
   * and `accepts`, for both.
   */
  editor?: () => Promise<{ default: ComponentType<FullEditorProps> }>
}

export interface FullEditorProps {
  /** The declared inputs' values, keyed by selector, as `PreviewProps.values`. */
  values: Readonly<Record<string, unknown>>
  registry: RegistryLookup
  /**
   * Where the sheet's preview is on screen, with a picture of it, which the editor opens
   * out of and closes back into. Null when it cannot be measured, and the editor then
   * simply appears.
   */
  origin: () => EditorOrigin | null
  /**
   * Done, with the inputs the editor changed, keyed by selector. Called once the
   * closing motion has finished, so the sheet's preview is back in place to land on.
   * Only the binding's own inputs are written; anything else is ignored.
   */
  onDone: (values: Readonly<Record<string, unknown>>) => void
}
