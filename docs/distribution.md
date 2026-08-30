# Distribution

How Kommands reaches a user, and what each build can do.

There are **two builds from one codebase**: a hosted web app, and a standalone
desktop app. Neither is the "real" one. They differ in exactly one dimension —
access to the local filesystem — and everything that follows in this document
follows from that.

[`architecture.md`](architecture.md) covers the command pipeline; this document
covers the shells around it and the boundary with Konnekt.
[`persistence.md`](persistence.md) specifies the formats that cross that boundary.

---

## The two builds

|                        | **Web**                | **Standalone**                              |
| ---------------------- | ---------------------- | ------------------------------------------- |
| What it is             | The Vite build, hosted | The same Vite build inside a Wails v2 shell |
| Command generation     | Complete               | Complete — identical code                   |
| 3D previews            | Yes                    | Yes                                         |
| Saved commands         | `localStorage`         | A JSON file on disk                         |
| Works with no internet | No                     | Yes — data is embedded in the binary        |
| Linked into Konnekt    | **No, and never**      | Yes                                         |
| New Minecraft version  | On deploy              | On release                                  |

The renderer, the serializers, the schema, the argument-type editors and the
previews are **one codebase with no build-target branching**. A `if (desktop)` in
`src/` would be the same mistake as a version-number comparison in a serializer: the
difference is a capability, so it belongs behind a capability interface, not behind a
flag every call site has to remember.

The one place the split is allowed to be visible is the **UI**, and there it is
mandatory rather than optional — see § The split must be visible.

---

## Why standalone exists

The user most likely to want Kommands is the one least likely to be able to reach it.
Someone running a Minecraft server on a LAN with no internet has no route to a hosted
site at all.

Two further things follow only from having a local process, and neither is reachable
from a browser tab at any price:

- **A command can outlive the session that built it in a place another application
  can read.** A browser tab cannot write to a shared location on disk. This is what
  makes linking with Konnekt possible, and its absence is what makes linking
  permanently impossible on the web.
- **Konnekt's presence is detectable.** The shell can check for Konnekt's data
  directory directly. A browser tab cannot tell whether a `konnekt://` handler is
  registered, so it cannot know whether the affordance it is offering leads anywhere.

The web build is not a lesser version of this. It is the one that costs a user
nothing to try, and it generates every command the desktop build does.

---

## The shell is Wails v2

Assessed against Tauri v2, Electron, and starting fresh on Wails v3. The full
comparison is in [#44](https://github.com/kollektiv-mc/Kommands/issues/44); the
reasoning that matters downstream:

- **Tauri** has the best packaging story and a ready-made deep-link plugin, but costs
  Rust as a third language in a two-language suite, maintained for one small shell.
- **Electron** adds no new language and bundles Chromium, which would guarantee the
  WebGL behaviour the previews are developed against. Konnekt already answers that
  argument by shipping three.js and React Three Fiber on WebKitGTK, WebView2 and
  WKWebView. Without it, Electron is roughly 150 MB installed against roughly 15 MB.
- **Wails v2** wins on suite fit. Konnekt is a Wails v2 app, so the per-platform
  packaging files have a working reference, the release workflow has a shape to copy,
  and the URL-scheme and single-instance handling is written once as Go that both
  apps can share.
- **v3 was considered and declined.** The shell is single-window, so v3's headline
  features buy it nothing; its scheme-handler and single-instance APIs differ, so two
  majors in the suite would mean writing the one genuinely shareable piece of Go
  twice; and its default Linux stack drops the distributions Konnekt's README
  promises.

**The consequence that outlives the shell choice** is not the shell. Both apps
computing `os.UserConfigDir()` from the same Go standard library call means neither
has to discover the other's data directory: Konnekt's is `os.UserConfigDir()/konnekt`,
this one's is `os.UserConfigDir()/kommands`, and each derives both by construction.
Every other option would require replicating Go's per-platform path rules and keeping
them in step by hand.

---

## Command data is bundled, not fetched

Offline is the entire point, so the data ships in the binary.

The cost is small and already measured: 1.21.1 is 1.5 MB across three files —
`commands.json` 560 KB, `registries.json` 668 KB, `blocks.json` 260 KB, uncompressed —
against a shell of roughly 15 MB. Several supported versions stay under the noise
floor of the binary.

The part that makes this the right answer rather than merely an affordable one is
that it is the **zero-code-change option**. `src/data/loadGenerated.ts` already loads
every file through a per-file dynamic import, so Vite code-splits each into its own
chunk — precisely so a session that never opens a block editor never downloads
`blocks.json`. Those chunks are served from embedded assets instead of over the
network, and nothing in the loader changes. Fetching would need a fetch path, a
cache, an offline fallback, and a deployment.

The trade-off, accepted knowingly: **new Minecraft version data reaches standalone
users only in a new release.**

---

## The Konnekt boundary

Konnekt is the suite's other product — a Wails desktop dashboard for Minecraft
servers. See [`suite.md`](suite.md).

**Kommands never talks to a Minecraft server.** It opens no socket, speaks no RCON,
and never learns a server address. That restriction is permanent and is not softened
by anything here — see [`roadmap.md`](roadmap.md) § Explicitly out of scope, which
states it as a network boundary rather than as a limit on where output may travel.

What crosses the boundary is never a connection. There are exactly two mechanisms,
and they are different features:

| Mechanism                                                                     | Direction                      | Lifetime                                    | Builds             |
| ----------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- | ------------------ |
| `konnekt://` link ([#46](https://github.com/kollektiv-mc/Kommands/issues/46)) | Kommands → Konnekt             | **One-shot.** No relationship after arrival | Both, with caveats |
| Shared file ([#45](https://github.com/kollektiv-mc/Kommands/issues/45))       | Kommands writes, Konnekt reads | **Bound.** Later edits propagate            | Standalone only    |

### The one-shot handoff

Konnekt registers a `konnekt://` scheme and lands the payload in its console input,
prefilled and focused, for a human to press enter on. Its guarantees shape what is
worth sending:

- **It never auto-executes.** So the payload does not need to be, and should not be,
  anything Konnekt could act on unattended.
- **It validates and bounds the payload** — length cap, control characters and
  newlines rejected, so one link cannot become several commands.
- **It shows which link it came from** before the user commits.

The newline rule is the one to design against here rather than discover later. A
generated command is single-line by construction, but `raw_text` and the expression
arguments used by `//generate` carry whatever a user typed. **Reject at the sender
too**, rather than relying on the receiver to catch it.

### The bound link

A `konnekt://` push cannot keep a command bound, because it is write-only: it can
deliver a change while Konnekt is running, but has no answer for "what changed while
it was closed", which is half the requirement. A sync service is out of scope on both
sides — Konnekt's roadmap puts a cloud backend under explicitly out of scope, and
this repo has no backend by design.

So the transport is a file on local disk, specified in
[`persistence.md`](persistence.md) § The shared file. **Kommands writes it; Konnekt
only ever reads it.** That asymmetry is the whole design — it makes divergence
structurally impossible rather than merely unlikely.

The responsibility consequence is worth stating plainly, because it is easy to
acquire by accident: **a command edited here can change what another application runs
against a live world, without a human reading it in between.** Konnekt surfaces a
changed link non-blockingly and reversibly, but it does not require a confirmation.

---

## The split must be visible

Linking is standalone-only and always will be. The failure mode to design against is
a user discovering that by finding nothing where they expected something.

So in the web build the affordance is **present but disabled, with a stated reason
and a route to the desktop build** — not absent. `SavedCommandStorage.kind` exists to
be read for exactly this, rather than sniffing the user agent or checking for a global
the shell injects.

The `konnekt://` action is the harder case, because in the web build there is no way
to know whether it leads anywhere. The options are to show it unconditionally and
accept the dead-link case, or to put it behind an explicit "I have Konnekt"
preference. **This is open** — see [#46](https://github.com/kollektiv-mc/Kommands/issues/46).

---

## What this changes for the repo

A JS-only repo grows a second toolchain: `go.mod`, `go.sum`, and a Go job in CI.

Two things have to move with it, and neither is automatic:

- **`.claude/suite.json`** gains the Go checks in `health.commands`, so
  `/suite-kit:health` and CI cover them. Until they exist, the manifest records the
  pending change in its `distribution` block rather than declaring a check that
  cannot run — CI runs `suite-check.py --require-runnable`, where a skip is a
  failure, and that is the property worth keeping.
- **[`suite.md`](suite.md)** no longer gets to draw the line between the two products
  at "Konnekt is a Go module, Kommands is a Vite app". That was never the real
  argument for separate repositories, and it stops being true here.

Tracked in [#44](https://github.com/kollektiv-mc/Kommands/issues/44).
