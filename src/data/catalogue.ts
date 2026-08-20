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

/**
 * The commands a definition's `@any` Refs may embed.
 *
 * `docs/command-schema.md` says `'@any'` means any command **in the same dialect** and
 * version, and that is not a formality: `/execute … run` hands its tail to the vanilla
 * command dispatcher, so offering `//generate` there produces
 * `/execute run //generate …` — a command that reads fine and cannot run.
 *
 * Filtered once, where the catalogue is handed to a command, rather than at each of
 * the two places that consume it. The picker and the serializer then cannot disagree
 * about what is embeddable, because they are looking at the same set.
 */
export function embeddableIn(
  catalogue: Readonly<Record<string, CommandDefinition>>,
  host: CommandDefinition,
): Readonly<Record<string, CommandDefinition>> {
  return Object.fromEntries(
    Object.entries(catalogue).filter(([, command]) => command.dialect === host.dialect),
  )
}
