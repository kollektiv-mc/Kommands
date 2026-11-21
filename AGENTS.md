# Kommands

Minecraft Java Edition command generator. Target version **1.21.1**.

Two builds from one codebase: a hosted web app, and a standalone desktop app with
local storage and Konnekt integration. They differ in one dimension: access to the
local filesystem. See `docs/distribution.md`.

Rules shared with other projects are in `.claude/rules/`. An agent that does
not load that directory itself reads `working.md`, `writing.md` and
`simplicity.md` there before starting.

## Stack

Vite · React 19 · TypeScript (strict) · TanStack Router · Zustand · Tailwind v4 ·
Vitest · ESLint · Prettier, with pnpm. The desktop shell is Go and Wails v2.

## Commands

```sh
pnpm dev | build | typecheck | lint | test | format:check
pnpm build:desktop       # build with the Go shell's licences too; what `wails build` runs
pnpm test:coverage       # with the line floor in vite.config.ts
pnpm check-bundle        # entry-chunk gzip budget
pnpm gen                 # gen:commands (mcmeta), gen:tokens, gen:fingerprints
go run ./scripts/coverage-floor   # the shell packages' coverage floor
python3 .claude/suite-check.py    # every health check in .claude/suite.json
```

Three.js and `@react-three/fiber` are reached **only** through a dynamic import so
they stay out of the entry chunk. `pnpm check-bundle` fails if the renderer appears
there. See `docs/adding-a-preview.md`.

The desktop shell is a Go/Wails v2 module at the repo root
([#44](https://github.com/kollektiv-mc/Kommands/issues/44)): cgo-free, tested
core packages under `shell/`, assembled by `main.go`, which embeds the Vite
build from `dist/`. `go vet` and `go test` over `./...` need `pnpm build` first;
the runner reports them as skipped where `dist/` is absent. Linking the shell
needs system webkit2gtk headers and runs as CI's `shell` job.

The aislop gate's rules are in `.claude/rules/aislop.md`. Never run `aislop fix`.

## Conventions

Formatting is Prettier-enforced: no semicolons, single quotes, trailing commas,
100 columns, 2-space indentation.

Four rules the formatter cannot hold, checked by `.claude/suite.json`:

1. **No hardcoded game values.** Item IDs, entity IDs, enchantments, effects,
   particles, attributes, selectors and colour codes appear as literals only in
   `src/data/`. See `docs/minecraft-versions.md`.
2. **No literal hex or px in components.** `src/components/**` and `src/routes/**`
   use `var(--token)` or the Tailwind semantic utilities. A missing value is a
   token to add in kollektiv's `design/tokens.json`. See `docs/design-tokens.md`.
3. **Never hand-edit `src/data/generated/**` or `src/styles/tokens.css`.** Change
   the input and regenerate. A `fingerprints.json` diff is the one to _read_: a
   definition's structure moved, which invalidates saved commands built against
   it (`docs/health-checklist.md` § 3).
4. **Never hand-edit `tokens.source.json`.** kollektiv's `scripts/sync-tokens.sh`
   writes it from `design/tokens.json`, which Konnekt reads too.

- Command definitions are **data, not code**. Adding a command means adding a
  definition, never writing a page. See `docs/adding-a-command.md`.
- Serializers branch on **version traits**, never on version numbers. A
  `version === '1.21.1'` comparison anywhere in `src/` is a bug.
- Verify Minecraft syntax against [minecraft.wiki](https://minecraft.wiki) or the
  mcmeta data for the target version. Training data is often stale: 1.21.1 sits
  between two breaking changes.

## Docs

Each fact lives in exactly one file. This file links; it does not restate.

| File                         | Answers                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `docs/architecture.md`       | How the system fits together, and why it is shaped this way       |
| `docs/distribution.md`       | The web and standalone builds, the Konnekt boundary, and releases |
| `docs/persistence.md`        | Saved commands, links, and the file Konnekt reads                 |
| `docs/command-schema.md`     | The authoritative command definition schema                       |
| `docs/minecraft-versions.md` | Which syntax differs per version, and what 1.21.1 emits           |
| `docs/adding-a-command.md`   | Adding a command definition                                       |
| `docs/adding-a-version.md`   | Adding a Minecraft version                                        |
| `docs/adding-a-preview.md`   | Adding a 3D preview module                                        |
| `docs/generate-editor.md`    | What `//generate` can express, and the shape of its 3D editor     |
| `docs/home-page.md`          | The web home page and the download page, as designed              |
| `docs/design-tokens.md`      | The token pipeline and the full token set                         |
| `docs/roadmap.md`            | Now / Next / Later                                                |
| `docs/health-checklist.md`   | The quality yardstick, and what is currently open against it      |
| `docs/suite.md`              | The suite this repo belongs to, its tooling and tracking          |
| `docs/brand/README.md`       | The Kommands mark, its construction, colours and icon files       |

Read `docs/minecraft-versions.md` before writing or changing any serializer.

## Definition of done

Run `python3 .claude/suite-check.py`. A check it reports as skipped did not pass.
Then check the area you touched against `docs/health-checklist.md`, and confirm
the change is in scope for `docs/roadmap.md`. A gap you cannot close now goes
under that checklist's `Open backlog`.

## Task tracking and pull requests

Work is tracked in GitHub Issues, mirrored into Linear by kollektiv's
`/suite-kit:suite-sync`. Every issue carries a `type:`, an `area:` and exactly
one priority (`p0`-`p3`) label; an issue opened through the API sets it in the
same call, `p2` when unclear. Close issues with `Fixes #N`.

Follow `CONTRIBUTING.md`: one pull request per piece of work, a `## Changelog`
line per change, an `area:` label. `.github/changelog.json` lists the paths that
never reach what ships.

## Files that come from the template

Some files are owned by sandrogekeler/AllesSandro and must not be edited here:
`.claude/rules/template-files.md` lists them. `tokens.source.json` and
`.github/labels.json` are written by kollektiv's sync scripts.

## Do not

- Commit secrets, `.env` files or credentials.
- Add a `TODO.md`: work is an issue.
- Add a dependency without reading `agent_docs/DEPENDENCIES.md`.
