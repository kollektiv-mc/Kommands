# Architecture

How Kommands fits together, and why it is shaped this way.

The schema itself is specified in [`command-schema.md`](command-schema.md); this
document covers the system around it and the reasoning behind the structure.

---

## The constraint

More command types will be added, and which ones is undecided. Every structural
decision here follows from that: **adding a command must be a data change, not a
code change.** A design where each command is a hand-written page fails the moment
the command list grows, because the cost of each addition stays constant instead of
falling.

So a command is a **definition** — data describing its arguments, constraints, and
output — interpreted by a generic renderer.

---

## Layers

```
version data  ──►  command definitions  ──►  renderer  ──►  serializer  ──►  output
   traits            (derived|authored)       (editors)      (traits)      command text
   registries                                     │
                                                  └──►  preview module (optional, lazy)
```

| Layer | Responsibility |
|---|---|
| **Version data** | Which values exist (registries) and how they are written (traits) |
| **Definitions** | The shape of each command: nodes, argument types, constraints |
| **Renderer** | Walks a definition, renders an editor per argument, holds the value tree |
| **Serializer** | Turns the value tree into command text, branching on traits |
| **Preview** | Optional 3D visualisation, bound to a definition, lazy-loaded |

The renderer never knows which command it is rendering, and the serializer never
knows which version it is targeting beyond the traits it is handed.

---

## Derivation: what can and cannot be generated

Vanilla command *skeletons* are derived from the Brigadier command tree that
Minecraft itself exports, republished per version by
[misode/mcmeta](https://github.com/misode/mcmeta). For 1.21.1 that tree holds 83
commands across 1763 nodes, using 51 distinct argument parsers.

**Brigadier describes shape, never semantics.** `/give` reduces to:

```
give → targets (minecraft:entity, {type:players, amount:multiple})
     → item   (minecraft:item_stack)          ← executable
     → count  (brigadier:integer, {min:1})    ← executable
```

Everything that makes a `/give` generator worth building — the entire data-component
system — sits behind the opaque token `minecraft:item_stack`. Likewise the whole
text-component tree is just `minecraft:component`.

This produces the real boundary in the system. It is **not** vanilla versus
WorldEdit; it cuts across both:

|  | Command skeleton | Argument type editors |
|---|---|---|
| **Vanilla** | **Derived** from Brigadier | **Authored** |
| **WorldEdit** | **Authored** | **Authored** — shared with vanilla |

A vanilla command is therefore `derived skeleton + authored type bindings +
authored presentation metadata`. WorldEdit swaps only the first term. Everything
downstream is identical, which is why both use one schema with a `dialect` field
rather than two subsystems behind an interface.

### The derivation step

`scripts/derive-commands.ts`, run by `pnpm gen:commands`:

1. Fetch `<version>-summary/{commands,registries,blocks}/data.json` from mcmeta,
   pinned by tag.
2. Walk the tree, emitting schema nodes.
3. Resolve `redirect` into `Repeat`; resolve the childless `run` literal into a
   `Ref` back to the command root.
4. Map each `parser` + `properties` pair to an argument-type key and options.
5. Write `src/data/generated/<version>/`, stamped `provenance: 'derived'`.

**Failure policy:** an unmapped *shallow* parser (a plain scalar such as an integer
or boolean) is a hard error — those must be generically representable. An unmapped
*deep* parser binds a `raw_text` fallback editor and records the gap, so a command
degrades to a text field rather than breaking the build.

All 83 commands are emitted, though only `/give`, `/tellraw`, and `/execute` have
authored editors and routes today. Emitting the full tree costs nothing extra — it
is one walk — and it means adding a command later is a routing and editor decision
rather than a data problem.

### Generated output is committed

`src/data/generated/**` is committed, not gitignored. The reasoning:

- Version bumps produce **reviewable diffs**. The 31 attribute renames in 1.21.2
  appear in a pull request instead of silently changing behaviour.
- Builds work **offline**; CI needs no network, and an mcmeta outage cannot break
  the build.
- No build-order dependency between data generation and typechecking.

The cost is repository size and the risk of hand-edits. The latter is mitigated by
a DO-NOT-EDIT header on every generated file and a rule in
`.claude/rules/generated-data.md`.

### The mcmeta quirk

mcmeta's summary format serialises redirect-to-root as a **childless literal**. The
`execute` tree's `run` node therefore appears empty rather than pointing anywhere.
The deriver special-cases it. Any future node that redirects to the tree root will
hit the same representation.

---

## Why the schema is a tree

`/execute` rules this out as a flat argument list:

- `execute as <targets>` carries `redirect: ["execute"]` — it recurses, so clauses
  chain arbitrarily.
- `run` embeds **another entire command**.

A flat `arguments: []` array cannot express either. The schema is therefore a node
tree with `Sequence`, `Choice`, `Repeat`, and `Ref`. Any schema that survives
`/give` and `/tellraw` but not `/execute` is the wrong schema — `/execute` is the
acceptance case.

WorldEdit adds three further requirements, all visible in `//generate`:
boolean **flags**, a **variadic** tail, and a **mutual-exclusion constraint**
between the `-r`, `-o`, and `-c` origin modes. These are new node kinds, not a new
schema.

---

## Versioning

Two independent axes — syntax traits and registry contents — specified in
[`minecraft-versions.md`](minecraft-versions.md).

The design requirement is that adding 1.21.5 must be a new definition set plus an
adapter, never a refactor. That holds because **serializers branch on traits, not
version numbers**. Adding 1.21.5 flips three trait flags and adds a generated
registry set; adding 1.21.2 flips one. Neither touches serializer control flow.

If a future version differs in a way no trait captures, the change is to add a
trait and give every existing version an explicit value — still additive.

---

## Where data lives

| Category | Source | Loading |
|---|---|---|
| Items, entities, enchantments, effects, particles, attributes, potions, sounds | mcmeta → `src/data/generated/<v>/registries.json` | Lazy, per version |
| Block states | mcmeta → `src/data/generated/<v>/blocks.json` | Lazy, route-split |
| Command skeletons | Derived → `src/data/generated/<v>/commands.json` | Lazy, per command route |
| Version traits | `src/data/versions/<v>.ts` | Static |
| Selectors, colour codes, WorldEdit patterns and masks | `src/data/authored/` | Static |
| Design tokens | Generated → `src/styles/tokens.css` | Global CSS |

Nothing in this table is a literal inside a component. `/suite-kit:health` enforces it.

Registry files are large — 640 KB for 1.21.1 registries, 230 KB for blocks — so they
are loaded on demand rather than bundled into the entry chunk.

---

## Previews

3D previews are first-class, not bolted on. A definition declares a preview the
same way it declares arguments:

```ts
preview: {
  module: 'worldedit/shape',
  inputs: ['expression', 'pattern', '-h'],
}
```

The contract that keeps this decoupled: **a preview module receives parsed argument
values, never the command string.** It never parses text, and no command definition
needs to know Three.js exists.

A shared `<PreviewCanvas>` owns the renderer, camera, and lighting; modules
contribute scene content only. Modules are dynamically imported per route, so
Three.js stays out of the main bundle — the abstraction is eager, the code is lazy.

Design detail in [`adding-a-preview.md`](adding-a-preview.md).

---

## Design tokens

The visual language is the suite's shared one, defined in
`kollektiv/design/tokens.json` and consumed by both products: a dense, dark-first
UI whose signature is **hairline `0.5px` borders and no shadows at all**, with
status colours stored as RGB channel triplets so alpha can be composed in one
token. Konnekt generates its own output from the same source, so neither product
copies the other.

`pnpm gen:tokens` emits `src/styles/tokens.css` from the vendored
`tokens.source.json`; Tailwind's `@theme inline` exposes those custom properties as
semantic utilities. Components reference tokens only — never a literal hex or px
value. Pipeline and conventions in [`design-tokens.md`](design-tokens.md); the
values themselves live in `kollektiv/design/tokens.json`.

The generator is not written yet — this repo is pre-scaffold. `tokens.source.json`
is in place and [`design-tokens.md`](design-tokens.md) specifies the contract to
implement.

---

## Decision record

| Decision | Alternative rejected | Why |
|---|---|---|
| Commands as data | A page per command | Command list is open-ended; per-page cost never falls |
| Schema as node tree | Flat argument list | `/execute` recurses and embeds commands |
| One schema + `dialect` | WorldEdit as sibling subsystem | `//generate` needs no structure vanilla lacks, and shares all argument editors |
| Derive skeletons only | Derive everything | Brigadier has no semantics for `item_stack` or `component` — the parts that matter |
| Emit all 83 commands | Emit only the three in scope | Same cost; makes future additions a routing decision |
| Commit generated data | Gitignore and generate on install | Reviewable version diffs, offline builds, no network in CI |
| Traits, not eras | Era enum | Changes do not land together — attributes moved at 1.21.2, enchantments at 1.21.5 |
| Preview receives values | Preview parses command text | Keeps previews independent of serializer and version traits |
