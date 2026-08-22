import { resolveTarget } from '../schema/addressing'
import type { ArgumentTypeKey, CommandDefinition } from '../schema/types'
import { previewModule, registeredPreviewIds } from './registry'
import type { PreviewModule } from './types'

/**
 * The other half of build-time binding validation.
 *
 * Invariant 7 in `src/schema/invariants.ts` already proves every `preview.inputs`
 * selector resolves to exactly one node in its own definition. That is the *names*
 * half. This is the *types* half `docs/adding-a-preview.md` asks for — a module's
 * `accepts` asserting the argument types it actually reads — and it lives here rather
 * than beside invariant 7 on purpose: putting it there would make `src/schema/` import
 * the preview registry, and the schema layer knowing what a preview is is exactly the
 * coupling `docs/architecture.md` arranges the layers to avoid.
 *
 * `src/data/catalogue.test.ts` runs invariants 6 and 7 over the whole catalogue.
 * `binding.test.ts` runs this the same way, so a definition change that breaks a module
 * fails CI rather than rendering an empty canvas.
 */

/**
 * Whether a selector names exactly one argument, of exactly this type.
 *
 * The helper `.claude/rules/previews.md` writes `accepts` in terms of. Built on
 * `resolveTarget` rather than a walk of its own, so "which node does this name mean" is
 * answered in one place — a second walk that disagreed with invariant 7 would report a
 * binding as sound that the invariant had already rejected, or the reverse.
 */
export function hasArgument(
  definition: CommandDefinition,
  selector: string,
  type: ArgumentTypeKey,
): boolean {
  const [only, ...rest] = resolveTarget(definition.root, selector)
  return rest.length === 0 && only?.kind === 'argument' && only.type === type
}

/** Whether a selector names exactly one flag. Flags carry no type to assert. */
export function hasFlag(definition: CommandDefinition, selector: string): boolean {
  const [only, ...rest] = resolveTarget(definition.root, selector)
  return rest.length === 0 && only?.kind === 'flag'
}

/**
 * What is wrong with a definition's preview binding, if anything.
 *
 * Strings rather than `Diagnostic`s, matching `definitionProblems`: a broken binding is
 * an authoring mistake, not something a user can act on in the form.
 *
 * `lookup` is injectable so the negative controls can register a deliberately wrong
 * module without putting one in the real registry. A check with no negative control
 * passes just as happily when it has stopped checking anything.
 */
export function previewProblems(
  definition: CommandDefinition,
  lookup: (id: string) => PreviewModule | undefined = previewModule,
): string[] {
  const binding = definition.preview
  if (binding === undefined) return []

  const module = lookup(binding.module)
  if (module === undefined) {
    return [
      `${definition.id}: the preview names module "${binding.module}", which is not ` +
        `registered. Known modules: ${registeredPreviewIds().join(', ') || 'none'}.`,
    ]
  }

  if (!module.accepts(definition)) {
    return [
      `${definition.id}: module "${binding.module}" does not accept this definition. ` +
        `Its accepts() asserts the argument types it reads — one of them has changed ` +
        `shape, or the binding is on the wrong command.`,
    ]
  }

  return []
}
