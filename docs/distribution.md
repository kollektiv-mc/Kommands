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

The shell exists, at the repo root: module `kommands`, pinned to the same Wails
v2.12 as Konnekt. The Go that carries behaviour lives in cgo-free packages under
`shell/` — path derivation, the atomic writer, the store and its projection, the
HTTP API, the localhost listener — each with its own tests, runnable in any
container with a Go toolchain. `main.go` is assembly only: it embeds `dist/`,
mounts the API, and hands the rest to Wails. Compiling _that_ file needs the
built frontend and the system webkit headers, which is why the health manifest
declares the `shell/` checks and CI's `shell` job owns the full compile —
see `.claude/suite.json`'s `distribution` note.

---

## One install, two surfaces

The local install offers its UI in two presentations, and they are the same
process:

- **A window of its own** — the Wails webview, the default.
- **A local webapp** — pass `--serve` and the same process additionally serves
  the same embedded build to a browser at `http://127.0.0.1:8642` (port via
  `--serve-port`). Off by default; a listener nobody asked for is surface
  nobody audits.

The browser here is only a rendering surface. The Go process remains the thing
touching the filesystem, so a session served to a browser saves, persists and
links exactly as the window does. This is why "can this session link?" must
never be answered by _presentation_ — a user-agent sniff, a `window.go` check —
and is instead answered by _the presence of the local backend_: both surfaces
reach the same HTTP API at `/api/…`, mounted once as asset-server middleware for
the webview and once on the listener for the browser, so the frontend cannot
tell the two apart. `GET /api/capabilities` is the probe; on the hosted site it
simply does not exist, and that absence — not the browser — is what "web build"
means to the frontend.

Two rules bound the listener, both deliberate:

- **Loopback only, by construction.** The bind address is not a flag. Serving a
  command generator to the LAN is a feature nobody asked for, and the
  single-instance work does not cover it.
- **The Host header is checked anyway** (`shell/serve`). Binding loopback does
  not stop DNS rebinding — a hostile page can point its own domain at
  127.0.0.1 and fetch "same-origin" against it — and what this API writes feeds
  a file another application runs against a live world.

Two surfaces over one saved-commands file is not the concurrency problem it
sounds like: both go through one handler with one lock in one process, and the
single-instance lock keeps it to one process per machine.

---

## The window is the app's, including its title bar

The desktop shell runs `Frameless: true`, and
[`src/components/TitleBar.tsx`](../src/components/TitleBar.tsx) draws what the system
bar used to: the wordmark, and minimize / maximize / close. Konnekt is frameless for
the same reason and its bar has the same order, height and tone on the close button —
the two products are one suite, and a user with both should not have to learn two
window bars. Everything in the bar is drawn by the app, so it themes like any other
surface, which a system bar never did.

Frameless is not "no window management": the injected runtime still arms a resize
border and the window manager still snaps. What is given up is the system's own
wordmark and three buttons.

The bar's `h-9` is the one measurement here that is load-bearing rather than
aesthetic. Wails checks that 6px resize border before it checks anything else, so any
part of a control inside the band presses the window edge instead of the control — and
a 24px button centred in a 36px bar starts at exactly 6px. **Shrinking the bar
silently breaks the close button.** That, the control order and the drag/no-drag
contract are all currently preserved as comments in two repositories rather than as a
suite standard, because `kollektiv/design/` holds tokens and no prose about
components. [#58](https://github.com/kollektiv-mc/Kommands/issues/58) proposes one.

**Window controls are the one thing that does not go through the HTTP API**, and that
is not an exception being carved out. There is no window on the other side of an HTTP
request — a `POST /api/window/minimise` has no correct implementation on the browser
surface — so `src/lib/window.ts` reads Wails' injected `window.runtime` directly.
`app.go` therefore still binds **no** Go methods to the frontend, and the API remains
the one JS↔Go surface, because nothing here is an _application_ method.

The bar is also the one place where **answering by presentation is right**, which is
worth stating precisely because § One install, two surfaces forbids it everywhere
else. "Can this session link?" must test for the backend, since the `--serve` browser
surface can link and a user-agent sniff would say it cannot. "Is this app drawing its
own window chrome?" is a question _about_ the presentation, and the browser surface is
genuinely a different answer: a tab has no window to minimise, and offering a control
that cannot work is the same failure one level down. The two questions must not be
confused — nothing in `window.ts` is consulted about storage or linking.

The gear beside the controls opens the app's settings, which are deliberately only two
sections: the theme, and what this build is. The second is this document's § The split
must be visible, stated as a cause rather than as a consequence — the dashboard says
linking needs the standalone build, and Settings says which build this is.

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

Detection runs in both directions, and neither side discovers a binary. This
shell stats Konnekt's data directory to decide whether Konnekt-facing
affordances lead anywhere; on every launch it writes `install.json` into its own
data directory (`shell/marker`) so Konnekt can tell an installed standalone from
an absent one — before anything has been saved, which is what the shared file's
existence cannot say.

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

A JS-only repo grew a second toolchain: `go.mod`, `go.sum`, and a `shell` job in
CI. Both of the things that had to move with it have:

- **`.claude/suite.json`** declares `go vet` and `go test` over `shell/` in
  `health.commands` — the checks that can genuinely run in any container with a
  Go toolchain. The full shell compile is deliberately _not_ in the manifest: it
  needs the built frontend and system webkit headers, so in most environments it
  would report skip, and CI runs `suite-check.py --require-runnable`, where a
  skip is a failure. It runs instead as explicit steps in CI's `shell` job,
  where the headers are installed. The manifest's `distribution` note records
  the same reasoning beside the checks themselves.
- **[`suite.md`](suite.md)** no longer draws the line between the two products
  at "Konnekt is a Go module, Kommands is a Vite app". That was never the real
  argument for separate repositories, and it stopped being true here.

What remains of [#44](https://github.com/kollektiv-mc/Kommands/issues/44) is the
release workflow: the shell compiles and passes CI, but until a workflow
produces installable artefacts there is nothing a user can download, which is
why the manifest still lists `desktop-wails-v2` under `planned`.
