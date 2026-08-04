# Roadmap

Direction and sequencing. Individual tasks live in
[GitHub Issues](../../issues) — this file does not track work items, and there is
no `TODO.md`.

---

## Now

Getting a single command generating correct 1.21.1 output end to end. The goal of
this phase is to **prove the schema against real commands**, not to ship breadth.

- Scaffold the app: Vite, React, TypeScript strict, router, Tailwind v4, Vitest
- `pnpm gen:tokens` → `src/styles/tokens.css`, with the full named scale so no
  component ever needs a literal hex or px value
- `pnpm gen:commands` → derive all 83 vanilla skeletons for 1.21.1 from mcmeta,
  committed
- Version trait model, plus the 1.21.1 definition
- Schema and renderer: `sequence`, `argument`, `literal` nodes
- Shallow argument types: `integer`, `bool`, `string`, `entity_selector`
- **`/give`** — including the `item_stack` deep editor with enchantments,
  `custom_name`, and `lore` in their 1.21.1 forms
- `/suite-kit:health` wired and passing

Exit criterion: `/give` produces every canonical output in
[`minecraft-versions.md`](minecraft-versions.md) exactly.

## Next

Completing the acceptance set. Each of these stresses part of the schema that
`/give` does not.

- **`/tellraw`** — recursive `text_component` editor, `json-string` trait
- **`/execute`** — exercises `repeat`, `choice`, and `ref`; the case that proves
  the tree schema was necessary
- **`//generate`** — first WorldEdit definition; exercises `flagset`, variadic
  arguments, and `mutex` constraints
- WorldEdit `we_pattern` and `we_mask` editors
- **WorldEdit expression evaluator** — standalone, fixture-tested. The largest
  single piece of work in the roadmap and a prerequisite for any shape preview.
  Not derivable from any data source.
- Preview infrastructure: shared `<PreviewCanvas>`, module registry, build-time
  binding validation
- **`worldedit/shape` preview** for `//generate`

Exit criterion: all four commands in the schema's acceptance set generate correct
output, and one 3D preview is live.

## Later

Breadth, once the foundations are proven. Ordering here is not fixed.

- More vanilla commands — skeletons already exist; each needs editors,
  presentation metadata, and a route
- Additional deep argument types: `nbt_compound`, `block_state`, `loot_table`
- **Version 2 support** — likely 1.21.5, which flips three trait flags. This is
  the real test of the version model: if it turns into a refactor, the trait
  design was wrong
- More previews: entity placement, particle emitters, structure bounds
- Command import — parse an existing command back into a value tree. Note this
  inverts the preview contract's direction and needs its own design
- Sharing: permalinks, saved commands
- Multi-command scripts and function-file export

---

## Explicitly out of scope

Recording these so they are not accidentally re-litigated:

- **Bedrock Edition.** Different command syntax entirely; not a version trait.
- **Versions before 1.20.5.** The `nbt` item format trait exists in the matrix for
  completeness, but no pre-component version is supported.
- **Server integration.** Kommands generates text; it does not connect to a server.
- **Accounts, tiers, subscriptions.** Removed with the previous codebase and not
  returning.

---

## Health indicators

The design is holding if:

- Adding a vanilla command touches only data, metadata, and a route
- Adding a Minecraft version touches only version data and generated files
- No file in `src/` compares a version number
- No component contains a literal hex or px value
- No game value appears outside `src/data/`

`/suite-kit:health` verifies the last three mechanically. The first two are judgement
calls — if either starts requiring code changes, surface it rather than absorbing
the cost.
