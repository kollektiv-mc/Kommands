# Persistence

What Kommands stores, in what shape, and what that obliges it to.

For most of this repo's life the answer was **nothing**. `useCommandStore` is
in-memory session state; close the tab and the command is gone. That is defensible
for a generator you visit once, and it stops being defensible the moment anything
refers to a command a second time.

Three things now do: saved commands, links that carry a command, and Konnekt reading
a command Kommands wrote. All three are the same format problem seen from different
sides, which is why they are specified together here rather than three times.

[`command-schema.md`](command-schema.md) specifies the **definition** schema — the
shape of a command as a thing to be built. This document specifies the **instance**
formats — the shape of a command someone actually built. They are different
artefacts with different compatibility obligations, and conflating them is how a
value tree ends up inheriting a definition schema's freedom to change.

---

## The obligation this creates

Nothing in `src/` has ever been a persisted format. Every existing schema change has
been free, because the only thing holding a value tree was a tab that was about to be
closed.

That ends here, in three escalating steps:

1. **Saved commands** make the value tree survive a reload. A schema change now has
   to migrate or reject what is on disk.
2. **Links** make it survive being pasted somewhere. A link is a persisted format the
   moment someone bookmarks one, and nobody will run a migration on it.
3. **The shared file** makes it a **cross-repo** compatibility surface. Once Konnekt
   reads it, a schema change here is a break there — in a different repository, on a
   different release cycle, which cannot be fixed in the same commit.

Every rule below exists because of one of those three.

---

## What a saved command is

A saved command holds a name, the `definition id` of the command it builds, the
Minecraft version it was authored against, and **the value tree** — not the rendered
command string.

> **Decided: the tree.** Storing the rendered text is much simpler and loses three
> things — a saved command cannot be reopened in the workbench, cannot be migrated
> across a version bump, and makes command import (still in `roadmap.md` § Later) the
> only way back in, so an unbuilt feature gates a built one. The tree costs a
> compatibility obligation the codebase has never carried, and § How values are keyed
> is the whole of what that costs.
>
> What makes the tree strictly better rather than merely richer is the cached
> `preview` string below. When a tree cannot be resumed, the command degrades to
> exactly what text-only would have stored — so the tree's worst case is the other
> option's normal case. There is no scenario where choosing text would have left more
> intact.
>
> Note what does **not** drive this. Konnekt matches on `id`, uses `revision` to detect
> change, and wants a string for its console input; text alone satisfies
> [#45](https://github.com/kollektiv-mc/Kommands/issues/45) and [#46](https://github.com/kollektiv-mc/Kommands/issues/46) completely. What needs the tree is resumable editing
> and [#43](https://github.com/kollektiv-mc/Kommands/issues/43)'s inbound seeding.

Alongside the tree, a saved command carries a small amount of data whose only job is
to let a list view render without paying for the real thing:

- A cached **`preview` string** — the serialized command as it stood at save time.
  This exists so a dashboard can show what a command is without pulling the 560 KB of
  command skeletons and 668 KB of registries that re-serializing would require. It is
  a cache, never the source of truth; the tree is.

### The identifier is the load-bearing part

**A stable `id`, generated once at save time and never regenerated.**

Not derived from the name, the definition, the content, or the position in a list. A
Konnekt preset stores `link: { source: 'kommands', id, revision }` pointing at it. An
id that changes when a command is renamed, re-saved, or reordered breaks every link
pointing at it — silently, with the user's only symptom being that edits stop
propagating.

**An id is never reused.** This is the rule that is easy to violate cheaply and
expensive to violate: a recycled id turns a deleted command into a silent replacement
of a working button on someone's dashboard. Deleting a saved command retires its id
permanently.

### The revision

A **`revision` that increments on every content change**, so a consumer can tell "I
have already seen this version" from "this changed" without diffing the tree.

Content, not metadata: what a reader needs to know is whether the command it would
run has changed.

### Version awareness

A value tree is only meaningful against the Minecraft version it was authored for. A
saved command outliving a version bump has to be either migrated or **clearly
marked** — never silently opened against the wrong version, which is exactly the
failure mode this repo's whole trait model exists to prevent.

Lean on `src/data/versions/` for this rather than storing a raw version string and
comparing it. Comparing version strings is the bug
[`minecraft-versions.md`](minecraft-versions.md) is written to prevent, and it does
not stop being one because the comparison happens at load time.

Resumability is therefore a **state, not a boolean**: a tree authored against the
current version, one authored against a version whose traits differ, and one
authored against a version this build does not know at all are three different
situations and want three different treatments in the UI.

---

## How values are keyed

This is the cost of the tree, and it is worth stating precisely rather than as a
general worry about compatibility.

### The path grammar is positional

`src/schema/paths.ts` builds three kinds of path segment:

```ts
child(parent, index)  → `${parent}/${index}`   // index into a Sequence's nodes[]
branch(parent, index) → `${parent}/|${index}`  // index into a Choice's nodes[]
instance(parent, id)  → `${parent}/#${id}`     // opaque, generated
```

Only the third is stable by construction. The other two are positions in a node array
that `pnpm gen:commands` **regenerates from mcmeta**. A path like `/1/|2/0` is a
statement about where a node currently sits, and the deriver is free to move it.

`choiceSelection` already says so in its own doc comment — _"a stored index can outlive
the branch it pointed at ... regenerating a skeleton with fewer branches"_ — but today
that is a within-session nuisance. Persisted, it is silent data loss across a release.

Stable instance ids (PR [#40](https://github.com/kollektiv-mc/Kommands/pull/40)) do not
help here. They fixed **values moving within a tree**; this is **the definition moving
underneath one**, which is a different problem with a different answer.

### Why name-addressing is not the answer either

[`addressing.ts`](../src/schema/addressing.ts) faced a version of this question for
constraints and preview inputs, and answered it emphatically:

> It is deliberately not a path: `/1/#0/|3/2` is positional and dies the moment the
> deriver reshapes the tree, and surviving regeneration is the entire reason rules
> address by name rather than by index.

That precedent does **not** transfer, for two independent reasons, and both were
checked rather than assumed.

**It is lossy.** Measured over the full 1.21.1 catalogue: of 952 argument and flag
locations across 79 definitions, **32 (3.4%) cannot be uniquely named** — 28 in
`/loot` and 4 in `/teleport`, where Brigadier separates the collisions by position
alone and there is no keyword to write. A rule can shrug that off, and `addressing.ts`
does: _"Neither is addressed by anything today."_ A save feature cannot, because a user
can build a `/loot` command and press save.

**It addresses the wrong half.** `staticLocations` returns arguments and flags, and
those are the only node kinds carrying a `name` — `SequenceNode`, `ChoiceNode`,
`RepeatNode` and `RefNode` have none. So a selector can name a value in `args` or
`flags`, but nothing in `choices`, `repeats` or `refs`, and those three hold the
**structure the argument paths hang from**. Knowing that `as/targets` was `@a` is
useless without knowing that the Repeat had one instance and the Choice had selected
that branch. Recovering structure from a bag of named values is an inference problem,
not a lookup, and it is not one worth solving speculatively.

### The decision: paths, with a fingerprint as a tripwire

A saved command stores **raw paths**, exactly as the store holds them, plus a
**structural fingerprint of the definition** it was built against.

The fingerprint covers only what can move a path or change what a value means:

| In                                                             | Out                                           |
| -------------------------------------------------------------- | --------------------------------------------- |
| Node kinds in tree order                                       | `label`, `description`, presentation metadata |
| Literal tokens                                                 | `aliases`                                     |
| Argument `name`, `type`, `optional`, `variadic`                | Constraint messages                           |
| Choice arity and branch order; flagset flag names; Ref targets | Anything the renderer only displays           |

Relabelling a command must not orphan a save; reordering a Choice's branches must.

**On load, the fingerprint decides, and there are only three outcomes:**

1. **Match** → resume from the paths verbatim. Exact, total, and it covers `/loot` and
   `/teleport` like anything else. This is the normal case and, given the rule below,
   very nearly the only one.
2. **Mismatch** → **do not attempt to resume.** The command is marked as saved against
   an older build of Kommands, and it degrades to its cached `preview`: still readable,
   still copyable, still sendable to Konnekt. Never a partial tree opened against a
   shape it was not built for — that is the failure this whole section exists to
   prevent, and a half-restored command is worse than an honest refusal because the
   user cannot see what is missing.
3. **Definition gone entirely** → the same as (2).

The fingerprint's job is therefore **detection, not recovery**. It is a tripwire, and
what it protects is stated in [`health-checklist.md`](health-checklist.md): a change
that moves a definition's fingerprint for a version already shipped is a release-gating
event. It ships with a migration, or with an explicitly accepted loss — never
unnoticed.

That rule is affordable because shape changes are **entirely within this repo's
control**. mcmeta is pinned by immutable tag and a test asserts it, so a definition's
shape for 1.21.1 cannot move on its own. It moves only when the deriver changes or an
authored definition is edited, which is a reviewed commit either way.

---

## Where it is stored

**Two backends, one interface**, chosen once at startup rather than branched at each
call site:

| Build          | Backend                                                     | Notes                                  |
| -------------- | ----------------------------------------------------------- | -------------------------------------- |
| **Web**        | `localStorage`, or IndexedDB if trees grow                  | Per-browser, no sync, and that is fine |
| **Standalone** | `store.json` on disk, projected into the file Konnekt reads | See § The shared file                  |

The standalone backend's canonical file, `os.UserConfigDir()/kommands/store.json`,
carries **the same envelope the web backend keeps in `localStorage`** —
`{ version, commands: [SavedCommand] }`, `src/storage/types.ts` — so the two
backends are one format in two places rather than two formats. The shell holds
entries as raw bytes and never interprets a saved command beyond the fields the
projection below needs (`shell/store`), which gives the file backend the same
unknown-field preservation `local.ts` gives the web one, structurally.

The interface exposes its `kind` (`'local' | 'file'`) because the UI is required to
make the capability split visible rather than let it be discovered — see
[`distribution.md`](distribution.md) § The split must be visible. That is what `kind`
is for; it is not a hook for behavioural branching elsewhere.

Two states are part of the interface rather than error paths bolted onto it:

- **`unavailable`** — a browser refusing site data still has a perfectly good
  generator. The UI says saving is off; it does not fall over.
- **`error`** — a quota-exceeded save has to surface. A save that silently did
  nothing is worse than one that failed loudly.

---

## The shared file

The transport for linked commands, and the only thing that crosses into Konnekt with
a lifetime longer than one message.

**Path:** `os.UserConfigDir()/kommands/saved-commands.json`, resolved by the Go shell
rather than guessed at from JS. Both apps use the same standard library call, so
Konnekt derives the identical path with no discovery and no configuration.

**Ownership: Kommands writes it. Konnekt only ever reads it.** That asymmetry is the
design, not an implementation detail — it is what makes divergence structurally
impossible, and it is why the canonical copy lives here rather than in a neutral
suite directory or in Konnekt's own data directory.

**Content: a projection of the store, not the store itself.** Each entry is
`{ id, revision, label, command, updatedAt }` — the schema Konnekt's reader pins
in its `backend/models/kommands.go`, mirrored on
[#45](https://github.com/kollektiv-mc/Kommands/issues/45): `label` from the
saved command's `name`, `command` from its cached `preview` with exactly one
leading slash stripped (console form — and the second slash of a WorldEdit
`//set` is content, not prefix), `updatedAt` as Unix milliseconds. Konnekt
matches on the `id` and uses the `revision` to tell "already seen" from
"changed" without diffing.

> **Decided: project, don't share the store file.** Konnekt's reader shipped
> first and pinned its entry schema, and that schema is not `SavedCommand`:
> different field names, a different timestamp type, and hard bounds — it
> refuses a file over 2 MiB or 2000 entries. Writing the store verbatim would
> mean either reshaping this repo's shipped persisted format around another
> repo's reader, or asking that reader to change and _still_ spending its byte
> bound on value trees it never reads. Projecting keeps each side's format its
> own: the canonical `store.json` stays byte-compatible with the web backend,
> and the shared file carries only what Konnekt consumes. It also solves a
> problem sharing would have created: store-only churn — `lastOpenedAt` moving
> because someone opened a command — projects to identical bytes, so the shared
> file's mtime holds still and Konnekt's poll stays quiet. `shell/store` owns
> the rules and pins each one with a test, including that entries containing
> control characters are excluded at the writer — the sender-side half of the
> newline rule, since this text reaches a server console and, once linked,
> can be fired by Konnekt's scheduler with no human in between.

### What the reader's behaviour requires of the writer

Konnekt polls `os.Stat` on this one file at startup, on window focus, and on a low
interval while open, re-reading when the mtime moves. That is Konnekt's business
except where it constrains this side, which it does in three places:

- **Writes must be atomic.** Write to a temp file in the same directory and rename
  over the target. A reader that catches a partial write sees invalid JSON — and it
  is polling, so it will catch one eventually.
- **A rewrite that changes nothing must not move the mtime.** Otherwise every poll
  interval becomes a spurious re-read on the other side.
- **The format carries a version field from the first commit**, and the reader must
  be able to skip an entry it does not understand rather than reject the file. An
  all-or-nothing reader turns one new field into every linked command breaking at
  once.

All three are implemented and pinned by tests: `shell/atomicfile` owns the
atomic rename and the unchanged-write skip, and `shell/store` writes the version
field, projects per entry, and stays inside the reader's entry and byte bounds.
What does not exist yet is the frontend driving them — the `file` backend behind
`resolveStorage` is [#45](https://github.com/kollektiv-mc/Kommands/issues/45)'s
remaining half.

### What Konnekt does with it

Recorded so the writer does not accidentally make these harder. All three are
Konnekt's to implement.

| Case                                    | Konnekt's behaviour                                                 |
| --------------------------------------- | ------------------------------------------------------------------- |
| A linked command's content changes here | Applied there, surfaced non-blocking as a changed badge, reversible |
| A linked command is deleted here        | The preset is kept and marked broken, never silently removed        |
| The linked command is edited in Konnekt | Forks to an unlinked copy after an explicit confirm                 |

The deletion case is the one with a writer consequence, and it is the never-reuse-an-id
rule above.

---

## Links

A permalink carries a command out of the app, and seeds one coming in. It shares this
document's encoding rather than inventing a second one for the same tree — that is
the point of specifying them together.

Three things are **open**, tracked in
[#43](https://github.com/kollektiv-mc/Kommands/issues/43), and each is a decision
rather than a detail:

- **What is encoded.** The value tree (restores an editing session, round-trips,
  makes "open this in Kommands and change one argument" work) or the rendered string
  plus context (far smaller, trivially stable, enough for the outbound direction
  alone). The inbound direction wants the tree; the outbound is satisfied by the
  string; the tree subsumes the string at a cost in URL length.
- **Path, query, or fragment.** A fragment never reaches a server, which matters if
  Kommands is deployed and a command contains something a user would not want in
  access logs. **Commands routinely contain player names.**
- **Length.** Value trees for a component-heavy `/give` are not small, and browsers,
  chat clients and Minecraft's own chat all truncate. Whatever the encoding, there
  needs to be a measured worst case and a defined behaviour past it — not a link that
  silently loses its tail.

### Seeded values are untrusted input

The inbound direction exists so Konnekt can open Kommands already knowing the
version, the loader, the active world and the **online player list** — a `/give` page
that knows the player names on the server is materially better than one that does not.

Those names arrive from outside the app and land in a generated command. They get the
same treatment as any other untrusted value: bounded length, control characters
rejected, and **no path where a seeded value becomes command text without passing
through the argument's own serializer.** A seed is a value, never a fragment of
output.

---

## Value shapes

Keys are only half the persisted surface. The values are structurally untyped at two
levels today:

```ts
args: Readonly<Record<Path, unknown>> // CommandValue
components: Readonly<Record<string, unknown>> // ItemStackValue
```

`unknown` was the right call while a value tree lived in a tab — the argument-type
registry erases its value parameter deliberately, and `defineArgumentType` is the one
cast that keeps the registry sound. It stops being free the moment the tree is written
to disk, because `unknown` means **no argument type currently has a declared value
shape**, and every one of them is now a compatibility surface.

So each argument type owes a written, versioned shape for what it stores — not what it
emits. The two differ: `serializeItemStack` branches on traits to write 1.21.1's form,
while `ItemStackValue` is what the editor holds and must survive being reloaded.

`ItemStackValue.components` is where this bites first. It is `Record<string, unknown>`
keyed by data-component id, and data components are exactly what 1.21.5 restructures —
enchantments reshaped, every attribute id renamed. A saved `/give` is the first thing a
version bump will meet.

This is roughly half the real work in saved commands, and it is invisible in the issue
as written, because `unknown` hides it.

---

## Testing obligations

These are the assertions that make the rules above real rather than aspirational:

- **Round-trip.** Save a value tree, reload it, resume editing, and serialize to
  byte-identical command text. The same property for encode → decode → serialize.
- **Id stability.** Rename, re-save, and reorder a saved command; assert the `id` is
  unchanged. Delete one and create another; assert the id is not reused.
- **Revision.** A content change increments it; a metadata-only change and a no-op
  save do not.
- **Atomicity and the no-op write.** A rewrite with unchanged content leaves the
  mtime alone.
- **Forward compatibility.** A file containing an entry with an unknown shape loads,
  minus that entry, rather than failing.
- **Fingerprint sensitivity.** Reordering a Choice's branches, renaming an argument or
  changing its type key moves the fingerprint; changing a `label`, a description or an
  alias does not. Both halves assert, because a fingerprint that moves too eagerly
  orphans saves for no reason and one that moves too rarely is not a tripwire at all.
- **Refusal, not partial restore.** A saved command whose fingerprint does not match
  resumes nothing and still renders from its cached `preview`. Assert that no value
  from the stale tree reaches the workbench.

The round-trip test is the one that catches the most: it is the only assertion that
holds the whole chain — tree, storage, reload and serializer — to the one thing a
user actually observes, which is the command text.
