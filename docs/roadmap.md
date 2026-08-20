# Roadmap

Direction and sequencing. Individual tasks live in
[GitHub Issues](../../../issues) — this file does not track work items, and there is
no `TODO.md`.

---

## Now

Completing the acceptance set. Each of these stresses part of the schema that
`/give` does not.

- **The `/execute` node editor** — the clause chain becomes a node-based builder
  rather than the stack of rows it is now. The current chain UI is a placeholder that
  proved the data layer end to end; it is not the intended design, and #33 (stable
  instance identity) is its prerequisite
- **The CSG graph** — the operation tree of
  [`generate-editor.md`](generate-editor.md), and its compiler down to expression
  text. Headless, like the evaluator, and the other half of what the node editor
  needs before it has anything to draw.
- Preview infrastructure: shared `<PreviewCanvas>`, module registry, build-time
  binding validation
- **`worldedit/shape` preview** for `//generate`

Exit criterion: all four commands in the schema's acceptance set generate correct
output, and one 3D preview is live. **All four commands are done**, and so is the
evaluator that was the long pole. What remains is the preview half: a graph that
produces expression text, and a canvas that draws what the evaluator returns.

## Done

Getting a single command generating correct 1.21.1 output end to end. The goal of
this phase was to **prove the schema against real commands**, not to ship breadth.
Its exit criterion — `/give` producing every canonical output exactly — is met.

- **WorldEdit expression evaluator** — `src/worldedit/expression/`, standalone and
  headless. Lexer, precedence-climbing parser, and a compiler to a closure tree; the
  full grammar, the built-in library — the maths names, `rotate` and `swap`, which take
  their arguments by reference, and `closest`/`gclosest` — and a per-point step budget
  so a `while` loop cannot hang the tab. Specified by WorldEdit's own test suite rather
  than by description: `ExpressionTest.java` and `RealExpressionTest.java` are
  transcribed rather than paraphrased, inside a 135-case suite that covers the traps
  (`^` is power, left-associative, and looser than a unary minus; postfix `!` is
  factorial; `&&`/`||` return an operand rather than a boolean; `~=` compares by ULPs)
  and the real shapes with their per-point expectations. World reads and the three
  noise functions parse and then say honestly that the preview cannot draw them, rather
  than being faked; `getBlockType*` are not functions at all, and say that instead.
- Scaffold the app: Vite, React, TypeScript strict, router, Tailwind v4, Vitest
- `pnpm gen:tokens` → `src/styles/tokens.css` from the vendored
  `tokens.source.json`, with the full named scale so no component ever needs a
  literal hex or px value. Konnekt's `frontend/scripts/gen-tokens.mjs` already
  implements this contract against the same source
- `pnpm gen:commands` → derive every vanilla skeleton for 1.21.1 from mcmeta,
  committed
- Version trait model, plus the 1.21.1 definition
- Schema and renderer: `sequence`, `argument`, `literal` nodes
- Shallow argument types: `integer`, `bool`, `string`, `entity_selector`
- **`/give`** — including the `item_stack` deep editor with enchantments,
  `custom_name`, and `lore` in their 1.21.1 forms
- `/suite-kit:health` wired and passing

It also produced two things the phase did not name, because `/give` needed them: the
`text_component` argument type — bound to fifteen arguments across five commands — and
one dynamic route resolving all 78 derived definitions, so reaching a command is a data
question rather than a routing one.

Then two more commands, both of which were meant to stress the schema and did:

- **`/tellraw`** — the recursive `text_component` editor, and the `json-string` trait
- **`/execute`** — `repeat`, `choice` and `ref` end to end: a reorderable clause chain
  and a command picker that renders the chosen command inline through the same walk.
  The chain is drawn as rows, which is **provisional** — the intended editor is
  node-based, and the rows exist to prove the data layer, not to settle the design

Then the last of the acceptance set:

- **`//generate`** — the first command with no derived skeleton at all: another
  dialect, a `flagset`, a variadic tail, and a `mutex` between its three origin modes

`/execute` is the one that paid for itself. It found that `optional` lived only on
`ArgumentNode`, so a clause led by a **keyword** — `/particle`'s `force|normal`,
`/difficulty`'s `peaceful|easy|normal|hard` — had nowhere to record that it could be
skipped, and a `Choice` with no empty state fell back to its first branch. 54 such
clauses across 22 commands were emitting a token nobody chose. That is the acceptance
set doing its job: the finding was a gap in the schema, not a command needing
special-casing, and `ChoiceNode.optional` closed it without the renderer learning a
single command's name.

`//generate` was the cheap one, which is the result that matters. It needed **no new
node kind and no second schema** — `flagset`, `variadic` and `mutex` were already
there — so the whole of it was a definition, two argument types, and a catalogue that
merges authored definitions with derived ones. `dialect` stayed a field. It did
surface two things worth naming: `variadic` had been declared and read by nothing,
working only because `raw_text` passes spaces through; and the command page applied
vanilla's slash rule to a WorldEdit alias and printed `///gen`.

## Later

Breadth, once the foundations are proven. Ordering here is not fixed.

- More vanilla commands — skeletons already exist; each needs editors,
  presentation metadata, and a route
- Additional deep argument types: `nbt_compound`, `block_state`, `loot_table`
- **Version 2 support** — likely 1.21.5, which flips two trait flags. This is
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

Two questions this file is the right place to ask, because they are about direction
rather than code, and no check can answer either:

- Does adding a vanilla command still touch only data, metadata, and a route?
- Does adding a Minecraft version still touch only version data and generated files?

Both are judgement calls. If either starts requiring code changes, that is a finding
about the design — surface it rather than absorbing the cost.

Everything mechanically verifiable lives in
[`health-checklist.md`](health-checklist.md) and is run by `/suite-kit:health`.
