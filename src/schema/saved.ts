import type { CommandValue } from './serialize'
import type { VersionDefinition } from '../data/versions/types'

/**
 * A command someone kept.
 *
 * The decision this shape rests on — settled deliberately rather than in passing,
 * because everything downstream inherits it — is that a saved command holds its
 * **value tree**, not its rendered text. Text is much simpler to store and much worse
 * to have stored: it cannot be resumed for editing, cannot be migrated across a
 * version bump, and would make command import the only way back into the editor.
 * Storing the tree means the tree becomes a persisted format with compatibility
 * obligations it has never had before. That is the cost, and it is the right one.
 *
 * See docs/command-schema.md § Saved commands for the id and revision rules.
 */
export interface SavedCommand {
  /**
   * Generated once, at save, and never regenerated.
   *
   * This is the field that carries the weight. A linked Konnekt preset stores
   * `{ source: 'kommands', id, revision }` pointing here, so an id that changed on
   * rename, re-save or reorder would break every link pointing at it — silently, with
   * the user's only symptom being that edits stop propagating. Nothing in this module
   * writes `id` except `createSaved`.
   */
  readonly id: string
  /** What the user calls it. Display only — see `revision`. */
  readonly name: string
  /** The `CommandDefinition` this tree was built against. */
  readonly definitionId: string
  /**
   * The Minecraft version id it was authored for.
   *
   * Stored, but never compared as a number — see `resumability`, which resolves it to
   * a version definition and compares that version's *traits*.
   */
  readonly version: string
  /** The tree. The source of truth, and the thing an edit resumes from. */
  readonly value: CommandValue
  /**
   * The command text, as it serialized when this revision was written.
   *
   * A **cache, not the source of truth**: it is a pure projection of `value`, and the
   * tree wins wherever they disagree. It exists so a dashboard of saved commands can
   * show what each one is without loading the 560 KB of command skeletons and 668 KB
   * of registries that re-serializing needs — a list view that pulled both to draw a
   * dozen tiles is exactly the eager load the route split exists to avoid.
   *
   * The staleness this admits is cosmetic and self-healing: a serializer fix changes
   * what a tile reads only after the command is next saved, and opening it re-derives
   * the text from the tree immediately.
   */
  readonly preview: string
  /**
   * Bumped on every **content** change, so a consumer can tell "I have already seen
   * this" from "this changed" without diffing the tree.
   *
   * A rename does not bump it, and that asymmetry is the point rather than an
   * oversight: what a linked consumer runs is the command, and Konnekt's presets carry
   * their own label. Bumping on rename would tell every linked preset to re-read a
   * command that produces byte-identical output.
   */
  readonly revision: number
  /** ISO-8601. Set once. */
  readonly createdAt: string
  /** ISO-8601. Moves on any change, rename included. */
  readonly updatedAt: string
}

/** The fields a caller supplies; the rest are this module's to assign. */
export interface SavedCommandDraft {
  name: string
  definitionId: string
  version: string
  value: CommandValue
  preview: string
}

/** What `createSaved` needs from its environment, so a test can pin both. */
export interface SaveClock {
  now: () => string
  uuid: () => string
}

/**
 * The real clock and id source.
 *
 * `crypto.randomUUID` needs a secure context, which every browser this app runs in
 * provides — but not every *test* environment does, and a saved command whose id was
 * quietly a counter would defeat the one rule this schema most needs to hold.
 * Failing loudly is the correct behaviour for an id that must never collide.
 */
export const SYSTEM_CLOCK: SaveClock = {
  now: () => new Date().toISOString(),
  uuid: () => crypto.randomUUID(),
}

/** A new saved command. The only place an id is minted. */
export function createSaved(
  draft: SavedCommandDraft,
  clock: SaveClock = SYSTEM_CLOCK,
): SavedCommand {
  const at = clock.now()
  return {
    id: clock.uuid(),
    name: draft.name,
    definitionId: draft.definitionId,
    version: draft.version,
    value: draft.value,
    preview: draft.preview,
    revision: 1,
    createdAt: at,
    updatedAt: at,
  }
}

/** The same command, with new content. Keeps the id; bumps the revision. */
export function reviseSaved(
  saved: SavedCommand,
  content: Pick<SavedCommandDraft, 'value' | 'preview'>,
  clock: SaveClock = SYSTEM_CLOCK,
): SavedCommand {
  return {
    ...saved,
    value: content.value,
    preview: content.preview,
    revision: saved.revision + 1,
    updatedAt: clock.now(),
  }
}

/** The same command under a new name. Keeps the id *and* the revision. */
export function renameSaved(
  saved: SavedCommand,
  name: string,
  clock: SaveClock = SYSTEM_CLOCK,
): SavedCommand {
  return { ...saved, name, updatedAt: clock.now() }
}

/**
 * Whether a saved command can be resumed against the version now loaded.
 *
 * - `ready` — its version's traits match the active one's, so the tree serializes the
 *   same way it did when it was saved.
 * - `retraited` — a known version, but one that writes something differently. The tree
 *   survives; what it emits does not, so this needs a migration decision rather than a
 *   silent open.
 * - `unknown-version` — the id resolves to nothing this build knows, so there are no
 *   traits to compare and no honest claim to make.
 *
 * Traits rather than version numbers, and that is not a formality: no ordering of
 * version numbers describes the changes, because they did not land together — the
 * attribute rename at 1.21.2, the enchantments flattening and text-component move at
 * 1.21.5. Two versions with identical traits render a tree identically whatever their
 * numbers say, which is the whole claim of the trait model.
 *
 * Registry drift is deliberately *not* part of this answer. 1.21.1 holds
 * `generic.armor` where 1.21.5 holds `armor`, so a resumed tree can carry an id the
 * active version does not have — and the existing validators already warn about
 * exactly that, without blocking. Refusing to open the command instead would be this
 * function overruling the "validation warns, never blocks" rule from a layer that
 * cannot see which value is wrong.
 */
export type Resumability = 'ready' | 'retraited' | 'unknown-version'

export function resumability(
  saved: SavedCommand,
  active: VersionDefinition,
  findVersion: (id: string) => VersionDefinition | undefined,
): Resumability {
  const authored = findVersion(saved.version)
  if (!authored) return 'unknown-version'
  const traits = Object.keys(active.traits) as (keyof typeof active.traits)[]
  return traits.every((trait) => authored.traits[trait] === active.traits[trait])
    ? 'ready'
    : 'retraited'
}

/**
 * The counter a restored tree must resume from.
 *
 * `useCommandStore` hands out Repeat instance ids as `i0`, `i1`, … from a counter that
 * resets with the tree. Restoring a saved tree without restoring that counter starts a
 * session at `i0` while the tree already holds one — and two instances on one path is
 * precisely the failure the generated-id model exists to prevent (src/schema/paths.ts
 * § InstanceId). The seeded `seed:n` ids are a separate space and are skipped here for
 * the same reason they carry a prefix.
 */
export function nextInstanceIdFor(value: CommandValue): number {
  let highest = -1
  for (const ids of Object.values(value.repeats)) {
    for (const id of ids) {
      const match = /^i(\d+)$/.exec(id)
      if (match) highest = Math.max(highest, Number(match[1]))
    }
  }
  return highest + 1
}
