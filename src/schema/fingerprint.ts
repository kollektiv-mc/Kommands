import type { CommandDefinition, Node } from './types'

/**
 * A structural fingerprint of a definition — the tripwire that makes storing raw
 * paths safe.
 *
 * `docs/persistence.md` § How values are keyed sets out the problem. A saved command's
 * value tree is keyed by paths, and two of the three path segment kinds are
 * **positional**: `child(parent, index)` indexes a Sequence's `nodes[]` and
 * `branch(parent, index)` indexes a Choice's. Those arrays are regenerated from mcmeta
 * by `pnpm gen:commands`, so `/1/|2/0` is a statement about where a node sits *today*
 * and the deriver is free to move it. Within a session that is a nuisance; persisted,
 * it is silent data loss across a release.
 *
 * So a saved command records what the definition's shape was, and on load the two are
 * compared. The answer is deliberately binary and the failure deliberately total: a
 * mismatch **refuses to resume** and the command falls back to its cached `preview`.
 * A half-restored tree is worse than an honest refusal, because the user cannot see
 * what is missing.
 *
 * **This is detection, not recovery.** Nothing here migrates a moved tree;
 * `health-checklist.md` makes a moved fingerprint for an already-shipped version a
 * release-gating event that ships with a migration or an accepted loss.
 */

/**
 * The unit separator, U+001F — written as an escape, never as the literal character.
 *
 * Joining on a separator at all is load-bearing: literal tokens and argument names are
 * arbitrary text, so `['ab', 'c']` and `['a', 'bc']` join to one string without a
 * delimiter — two different shapes, one fingerprint, and a tripwire that silently does
 * not trip. A comma or a space has the same hole one step further out, because a token
 * may contain either.
 *
 * Spelled as an escape because the literal character is invisible in an editor and in a
 * diff, which makes `join(SEPARATOR)` and `join('')` look identical while behaving
 * nothing alike. That is not hypothetical — it happened while writing this file.
 */
const SEPARATOR = '\u001f'

/**
 * Emit the parts of a node that can move a path or change what a stored value means.
 * Everything a reader only displays stays out.
 *
 * `persistence.md` gives a table, and this follows its stated **principle** rather than
 * the table's literal rows, because two fields satisfy the principle and are absent
 * from it:
 *
 * - **`repeat.min`** — `seedInstances(min)` in `paths.ts` mints `seed:0`, `seed:1`, …
 *   segments for an untouched Repeat. Change `min` and those paths change, which is the
 *   definition of moving a path.
 * - **`choice.optional`** — `choiceSelection` resolves an *absent* selection to
 *   `NO_BRANCH` when the Choice is optional and to branch `0` when it is not. Flipping
 *   it changes which branch a tree with no stored selection applies, without touching a
 *   single stored byte.
 *
 * Both are exactly "can move a path or change what a value means". Dropping either is a
 * one-line change if review prefers the table read literally.
 *
 * `typeOptions` is deliberately **out**, though it is the closest call. Narrowing a
 * number's `max` can make a stored value invalid — but invalid is not misplaced, and
 * the argument's own validator already warns about it without blocking, which is what
 * `command-schema.md` requires. A fingerprint that moved for it would orphan saves the
 * validator was going to handle correctly.
 *
 * `flag.char` is out for the mirror-image reason: flags are keyed by `name`
 * (`serialize.ts` writes `` `${path}/${f.name}` ``), so `char` changes the emitted
 * token and moves no path. The command re-serializes from the resumed tree anyway.
 */
function describe(node: Node, out: string[]): void {
  out.push(node.kind)
  switch (node.kind) {
    case 'literal':
      out.push(node.token)
      return
    case 'argument':
      // `name` is not unique within a definition and does not need to be — this is a
      // positional walk, so a name is one more discriminator at a known position
      // rather than a key.
      out.push(node.name, node.type, node.optional ? '?' : '', node.variadic ? '...' : '')
      return
    case 'sequence':
      out.push(String(node.nodes.length))
      for (const child of node.nodes) describe(child, out)
      return
    case 'choice':
      // Arity and branch order both matter: `branch(parent, index)` indexes this array,
      // so reordering it repoints every stored selection beneath it.
      out.push(String(node.nodes.length), node.optional ? '?' : '')
      for (const branch of node.nodes) describe(branch, out)
      return
    case 'repeat':
      out.push(String(node.min ?? 0), String(node.max ?? ''))
      describe(node.node, out)
      return
    case 'flagset':
      out.push(String(node.flags.length), ...node.flags.map((flag) => flag.name))
      return
    case 'ref':
      out.push(node.definitionId)
      return
    default:
      return assertNever(node)
  }
}

/**
 * A new node kind must be a compile error here, not a silent blind spot.
 *
 * `describe` returns `void`, so without this an eighth `Node` kind would fall straight
 * through the switch having contributed nothing but its own `kind` string — and the
 * tripwire would stop seeing everything inside it while still returning a plausible
 * hash. `CommandRenderer` guards its own walk the same way and for the same reason.
 */
function assertNever(node: never): never {
  throw new Error(`unhandled node kind: ${JSON.stringify(node)}`)
}

/**
 * FNV-1a, twice, over 64 bits.
 *
 * Not `crypto.subtle` — that is async, and this is called during a synchronous save and
 * a synchronous load comparison. Not a one-pass 32-bit hash either: a collision here is
 * not a cosmetic near-miss but a **false match**, which resumes a tree against a shape
 * it was not built for — the one outcome `persistence.md` calls worse than refusing.
 * A second pass with a different multiplier costs three lines.
 */
function hash64(input: string): string {
  let a = 0x811c9dc5
  let b = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    a = Math.imul(a ^ code, 0x01000193) >>> 0
    b = Math.imul(b ^ code, 0x85ebca6b) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/**
 * The fingerprint of a definition's structure.
 *
 * Derived, never stored **on the definition**: a field inside each entry of
 * `commands.json` would be redundant with the tree beside it, and the walk is cheap
 * enough that there is nothing to buy by carrying one.
 *
 * That is not an argument against the separate index at
 * `src/data/generated/<v>/fingerprints.json`, which exists and is generated by
 * `pnpm gen:fingerprints`. It buys two things the walk cannot, and neither is speed:
 * it lets a caller with no catalogue — the dashboard — judge a saved tree without
 * loading 560 KB of skeletons, and being a committed file under the clean-diff check
 * turns a moved fingerprint into a line in a pull-request diff. The health check
 * owning that file is the point of it, not a cost.
 */
export function fingerprintOf(definition: CommandDefinition): string {
  const parts: string[] = []
  describe(definition.root, parts)
  return hash64(parts.join(SEPARATOR))
}
