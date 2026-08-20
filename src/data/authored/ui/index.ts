import type { CommandDefinition, UiMetadata } from '../../../schema/types'
import { giveUi } from './give'
import { tellrawUi } from './tellraw'

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
  'vanilla:tellraw': tellrawUi,
}

/**
 * The definition with its authored presentation, or unchanged if it has none.
 *
 * A definition that already carries `ui` keeps it. Only *derived* definitions need
 * this map — an authored one can simply hold its own metadata, since it is not the
 * file `pnpm gen:commands` overwrites — and an entry added here for one of those would
 * otherwise replace the labels sitting beside it in its own source.
 */
export function withUi(definition: CommandDefinition): CommandDefinition {
  if (definition.ui) return definition
  const ui = UI[definition.id]
  return ui ? { ...definition, ui } : definition
}
