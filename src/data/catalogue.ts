import type { CommandDefinition } from '../schema/types'
import type { VersionDefinition } from './versions/types'
import { loadCommands } from './loadGenerated'
import { authoredCommands } from './authored/commands'
import { withUi } from './authored/ui'

/**
 * Every command the app offers, from wherever it came.
 *
 * `docs/architecture.md` puts it as: a vanilla command is a derived skeleton plus
 * authored type bindings plus authored presentation, and WorldEdit swaps only the
 * first term. This is where that swap happens, and it is the whole of it — one merge,
 * no branch on dialect. Nothing downstream can tell a derived definition from an
 * authored one, which is the claim `//generate` exists to test.
 *
 * Separate from loadGenerated.ts on purpose: that module loads *generated* data and
 * says so, and an authored WorldEdit definition arriving out of a function of that
 * name would be a small lie that costs someone an afternoon later.
 */
export function loadCatalogue(
  version: VersionDefinition,
): Promise<Readonly<Record<string, CommandDefinition>>> {
  return loadCommands(version).then((derived) => {
    const merged: Record<string, CommandDefinition> = {}
    // Authored last, so a hand-written definition overrides a derived one of the same
    // id. That is the documented escape hatch for a skeleton mcmeta gets wrong — and
    // it is deliberate rather than incidental, so it is written down here.
    for (const [id, definition] of Object.entries({ ...derived, ...authoredCommands })) {
      merged[id] = withUi(definition)
    }
    return merged
  })
}

/** The catalogue as a list, ordered for display. */
export function catalogueList(
  catalogue: Readonly<Record<string, CommandDefinition>>,
): CommandDefinition[] {
  return Object.values(catalogue).sort((a, b) => a.label.localeCompare(b.label))
}
