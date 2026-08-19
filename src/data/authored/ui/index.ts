import type { CommandDefinition, UiMetadata } from '../../../schema/types'
import { giveUi } from './give'

/**
 * Presentation metadata, attached to a definition on the way to the renderer.
 *
 * Attached rather than stored: a derived definition lives in src/data/generated,
 * which is overwritten wholesale by `pnpm gen:commands` and carries a DO-NOT-EDIT
 * header. Writing labels into it would put hand-authored text in the one place that
 * cannot hold any.
 */
const UI: Readonly<Record<string, UiMetadata>> = {
  'vanilla:give': giveUi,
}

/** The definition with its authored presentation, or unchanged if it has none. */
export function withUi(definition: CommandDefinition): CommandDefinition {
  const ui = UI[definition.id]
  return ui ? { ...definition, ui } : definition
}
