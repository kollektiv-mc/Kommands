# Kommands

Minecraft Java Edition command generator. React web app. Target version **1.21.1**.

> **Scaffold status:** this repo currently holds docs and config only. `src/`,
> `scripts/`, and `package.json` do not exist yet. The commands below are the
> contract those files must satisfy — they are not yet runnable. Delete this
> block once the app is scaffolded.

## Stack

Vite · React 19 · TypeScript (strict) · TanStack Router · Zustand · Tailwind v4 ·
Vitest · ESLint · Prettier · Three.js (lazy-loaded per route).
Package manager: **pnpm**.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | `tsc && vite build` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `eslint src scripts` |
| `pnpm format` | `prettier --write .` |
| `pnpm format:check` | `prettier --check .` |
| `pnpm test` | `vitest run` |
| `pnpm test:watch` | `vitest` |
| `pnpm gen:commands` | Derive command skeletons + registries from mcmeta |
| `pnpm gen:tokens` | Regenerate `src/styles/tokens.css` from the Konnekt token source |
| `pnpm gen` | Both generators |

Run `/health-check` before calling any task done. It runs lint, typecheck, and
tests, and greps for the two things this codebase forbids (below).

## Conventions

Formatting is Prettier-enforced; do not hand-format. Non-default settings:
**no semicolons**, **single quotes**, **trailing commas everywhere**,
**100-column** print width, **2-space** indentation.

Three rules are not enforceable by the formatter and are checked by
`/health-check`:

1. **No hardcoded game values.** Item IDs, entity IDs, enchantments, effects,
   particles, attributes, selectors, colour codes — none may appear as literals
   outside `src/data/`. They are versioned data. See `docs/minecraft-versions.md`.
2. **No literal hex or px in components.** `src/components/**` and `src/routes/**`
   use `var(--token)` or the Tailwind semantic utilities only. Every value the
   design needs already has a named token; if one seems missing, add it to the
   token source rather than inlining. See `docs/design-tokens.md`.
3. **Never hand-edit `src/data/generated/**`.** It is derived from mcmeta and
   overwritten by `pnpm gen:commands`. Change the generator instead.

Other conventions:

- Command definitions are **data, not code**. Adding a command means adding a
  definition, never writing a page. See `docs/adding-a-command.md`.
- Serializers branch on **version traits**, never on version numbers. A
  `version === '1.21.1'` comparison anywhere in `src/` is a bug.
- Tests live beside their subject as `*.test.ts` / `*.test.tsx`.
- Task tracking is **Linear**, team `KMD`. Do not add a `TODO.md`, and do not open
  GitHub Issues — see `docs/suite.md`.

## Docs

Each fact lives in exactly one file. This file links; it does not restate.

| File | Answers |
|---|---|
| `docs/architecture.md` | How the system fits together, and why it is shaped this way |
| `docs/command-schema.md` | The authoritative command definition schema |
| `docs/minecraft-versions.md` | Which syntax differs per version, and what 1.21.1 emits |
| `docs/adding-a-command.md` | Adding a command definition |
| `docs/adding-a-version.md` | Adding a Minecraft version |
| `docs/adding-a-preview.md` | Adding a 3D preview module |
| `docs/design-tokens.md` | The token pipeline and the full token set |
| `docs/roadmap.md` | Now / Next / Later |
| `docs/suite.md` | The suite this repo belongs to — shared agent tooling and tracking |

`docs/minecraft-versions.md` is the file that prevents syntax bugs. Read it
before writing or changing any serializer.

## Working agreements

- Plan before non-trivial changes. Ask before destructive ones.
- If reality diverges from the documented design mid-task, stop and surface it
  rather than improvising a workaround.
- Verify Minecraft syntax against [minecraft.wiki](https://minecraft.wiki) or the
  mcmeta data for the target version. Training data on Minecraft syntax is
  frequently stale — 1.21.1 sits between two breaking changes and is easy to get
  wrong in both directions.
