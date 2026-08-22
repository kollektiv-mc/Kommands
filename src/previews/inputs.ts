import { pathsForTarget } from '../schema/addressing'
import type { CommandValue } from '../schema/serialize'
import type { CommandDefinition, PreviewBinding } from '../schema/types'

/**
 * The values a preview module is handed.
 *
 * Parsed values read straight out of the value tree — never the command string, which
 * is the one rule `docs/adding-a-preview.md` exists to state. There is deliberately no
 * serializer import in this file and none in the module contract.
 *
 * Resolution goes through `pathsForTarget`, the same function `src/schema/constraints.ts`
 * uses, so a preview and a constraint naming the same argument cannot disagree about
 * which node they mean.
 */

/**
 * Values for a binding's declared inputs, keyed by the selector that named them.
 *
 * A selector resolves to one *node* — invariant 7 guarantees it — but that node can
 * occupy several *paths* once it sits under a Repeat. So a selector under a Repeat
 * yields an array, and one anywhere else yields the bare value. `//generate` has no
 * Repeat, so every selector resolves to a single path today; the array case is what
 * stops a future definition quietly showing only its first clause.
 */
export function readPreviewInputs(
  definition: CommandDefinition,
  binding: PreviewBinding,
  value: CommandValue,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  for (const selector of binding.inputs) {
    const targets = pathsForTarget(definition.root, selector, value.repeats)
    const held = targets.map(({ kind, path }) =>
      kind === 'flag' ? value.flags[path] === true : value.args[path],
    )
    values[selector] = held.length === 1 ? held[0] : held.length === 0 ? undefined : held
  }

  return values
}

/**
 * A key that changes exactly when a declared input changes.
 *
 * This is what makes `docs/health-checklist.md` § 4's "recompute only when a value it
 * depends on changes" true rather than aspirational: the key is built from the declared
 * inputs alone, so editing an argument the module never asked for leaves it identical
 * and the module's props keep their identity.
 *
 * Serialized rather than compared field by field because the values are argument-type
 * shaped — a string, a flag, a pattern object — and the module contract deliberately
 * types them as `unknown`. Cheap: it covers the handful of names a binding declares,
 * not the value tree.
 */
export function previewInputsKey(values: Record<string, unknown>): string {
  return JSON.stringify(values)
}
