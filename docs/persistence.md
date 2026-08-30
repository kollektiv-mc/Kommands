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

> **Open decision.** Storing the rendered text is much simpler and much worse: it
> cannot be resumed for editing, cannot be migrated across a version bump, and makes
> command import the only way back in. Storing the tree means the tree becomes a
> persisted format with the obligations above, which it has never had. The tree is
> the direction everything downstream assumes — [#43](https://github.com/kollektiv-mc/Kommands/issues/43)
> notes the inbound link direction needs it and that it subsumes the text case — but
> it is recorded here as **not yet settled**, per
> [#42](https://github.com/kollektiv-mc/Kommands/issues/42). Settle it explicitly;
> do not let it be settled by whichever code lands first.

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

## Where it is stored

**Two backends, one interface**, chosen once at startup rather than branched at each
call site:

| Build          | Backend                                     | Notes                                  |
| -------------- | ------------------------------------------- | -------------------------------------- |
| **Web**        | `localStorage`, or IndexedDB if trees grow  | Per-browser, no sync, and that is fine |
| **Standalone** | A JSON file on disk — the one Konnekt reads | See § The shared file                  |

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

**Content:** the saved commands above, each carrying its `id` and `revision`. Konnekt
matches on the `id` and uses the `revision` to tell "already seen" from "changed"
without diffing.

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

The round-trip test is the one that catches the most: it is the only assertion that
holds the whole chain — tree, storage, reload and serializer — to the one thing a
user actually observes, which is the command text.
