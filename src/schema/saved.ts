import type { CommandValue } from './serialize'
import type { CommandDefinition } from './types'
import { fingerprintOf } from './fingerprint'
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
   * The structural fingerprint of the definition this tree was built against.
   *
   * The tripwire `persistence.md` § How values are keyed requires. Paths into a
   * Sequence or a Choice are positional, and `pnpm gen:commands` regenerates those
   * arrays — so without this, a deriver change silently repoints every stored value
   * and the only symptom is a command that quietly rebuilds itself wrong.
   *
   * Compared by `structureState`, never here: this module has no catalogue, and the
   * layer that does is the one that can answer.
   *
   * Optional because a record written before this field existed is still a valid
   * record and must still load — dropping it would be the reader rejecting what it
   * does not recognise, which is the thing `health-checklist.md` forbids. Absent
   * reads as `unverified`, not as a match.
   */
  readonly fingerprint?: string
  /**
   * When this command was last opened in the editor. Absent until it is.
   *
   * Drives the Recent panel, and is deliberately **not** `updatedAt`: the store orders
   * the Saved panel by `updatedAt`, so recording an open there would sort Saved by
   * recency of opening and make the two panels the same list.
   */
  readonly lastOpenedAt?: string
  /** Whether the user pinned it. Drives the Quick panel. */
  readonly pinned?: boolean
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
  fingerprint: string
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
    fingerprint: draft.fingerprint,
    revision: 1,
    createdAt: at,
    updatedAt: at,
  }
}

/** The same command, with new content. Keeps the id; bumps the revision. */
export function reviseSaved(
  saved: SavedCommand,
  content: Pick<SavedCommandDraft, 'value' | 'preview' | 'fingerprint'>,
  clock: SaveClock = SYSTEM_CLOCK,
): SavedCommand {
  return {
    ...saved,
    value: content.value,
    preview: content.preview,
    // Refreshed, not carried over. The tree being written is the one the workbench
    // just held, so it was built against whatever shape is loaded now — stamping the
    // old fingerprint onto it would describe a definition this tree never saw.
    fingerprint: content.fingerprint,
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
 * The same command, marked as opened just now.
 *
 * Touches neither `updatedAt` nor `revision`, and both omissions are load-bearing.
 * `revision` is content-only by the rule above. `updatedAt` is what the store sorts
 * the Saved panel by, so writing it here would order Saved by recency of *opening* —
 * which is the Recent panel's job, and would leave the two showing the same list in
 * the same order.
 */
export function touchOpened(saved: SavedCommand, clock: SaveClock = SYSTEM_CLOCK): SavedCommand {
  return { ...saved, lastOpenedAt: clock.now() }
}

/**
 * The same command, pinned or unpinned.
 *
 * Metadata like a rename, so no `revision` bump — what a linked consumer runs has not
 * changed. Unlike a rename it also leaves `updatedAt` alone: pinning is a filing
 * decision rather than an edit, and moving a command to the top of Saved because it
 * was pinned would be a surprising second effect for a one-click action.
 */
export function setPinned(saved: SavedCommand, pinned: boolean): SavedCommand {
  return { ...saved, pinned }
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
 * Whether the definition still has the shape this tree was built against.
 *
 * The second half of "can this be resumed", and deliberately a **separate function
 * from `resumability`** rather than a fourth state inside it — because the two are
 * answerable at different layers and one of them is answerable without loading
 * anything.
 *
 * `resumability` needs only the stored version string and the version table, both of
 * which are static. This one needs the definition's *fingerprint*, and there are two
 * ways to get one — which is why the answer is computed in `compareFingerprint` and
 * reached through two entry points rather than duplicated:
 *
 * - `structureState` hashes the definition it is handed. The editor has one in its
 *   loader data, so it pays nothing.
 * - `structureStateFromIndex` reads the committed index instead
 *   (`src/data/generated/<v>/fingerprints.json`, ~1.6 KB gzipped). The dashboard has
 *   no catalogue and cannot afford one — 560 KB of skeletons to check a hash is the
 *   exact load a saved command caches its `preview` to avoid — so a tile takes this
 *   door.
 *
 * The two must agree, and `fingerprints.test.ts` asserts the index matches
 * `fingerprintOf` over every definition, so the shared comparison below is the whole
 * of the difference between them.
 *
 * The refusal itself still lands at the moment of opening, which is where
 * `persistence.md` wants it: the command still lists, still shows its text, still
 * copies — it just does not restore a tree into a form that no longer fits it. What
 * the index buys is *warning* before the click, not a different outcome after it.
 *
 * A missing fingerprint answers `unverified`. A record saved before fingerprints
 * existed has an unknown provenance, and unknown is not a match.
 */
export type StructureState = 'verified' | 'stale' | 'unverified' | 'unknown-command'

/**
 * The comparison itself, against whatever the caller could find out.
 *
 * Four answers rather than a boolean, because they want four different things said to
 * the user. "The command is gone from this build" and "the command was reshaped" are
 * the same refusal but not the same explanation, and "saved before Kommands recorded
 * shapes at all" is neither — it is a record that predates the tripwire and can never
 * be verified, however unchanged the definition actually is.
 */
function compareFingerprint(saved: SavedCommand, expected: string | undefined): StructureState {
  if (expected === undefined) return 'unknown-command'
  if (saved.fingerprint === undefined) return 'unverified'
  return saved.fingerprint === expected ? 'verified' : 'stale'
}

export function structureState(
  saved: SavedCommand,
  definition: CommandDefinition | undefined,
): StructureState {
  return compareFingerprint(saved, definition ? fingerprintOf(definition) : undefined)
}

/**
 * The same verdict from the committed fingerprint index.
 *
 * For the caller that has no catalogue. `index` is the loaded
 * `fingerprints.json` for the version being judged against — the *active* version,
 * not the one the command was authored for, which is `resumability`'s question.
 */
export function structureStateFromIndex(
  saved: SavedCommand,
  index: Readonly<Record<string, string>>,
): StructureState {
  return compareFingerprint(saved, index[saved.definitionId])
}

/** Whether a tree may be restored. Only a positive verification qualifies. */
export function canResume(state: StructureState): boolean {
  return state === 'verified'
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
