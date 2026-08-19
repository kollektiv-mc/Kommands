# Adding a command

Adding a command is a **data change**. If you find yourself writing a page
component for one specific command, stop — the design has been circumvented.

Schema reference: [`command-schema.md`](command-schema.md).

---

## Which path applies

| Situation                                      | Path                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- |
| Vanilla command, already in the Brigadier tree | **A — wire up a derived skeleton**                         |
| WorldEdit or any non-vanilla command           | **B — author a definition**                                |
| Vanilla command needing a temporary override   | **B**, with `dialect: 'vanilla'`, `provenance: 'authored'` |

All 78 vanilla commands are already derived into
`src/data/generated/<version>/commands.json`, with the five alias invocations
(`/tell`, `/w`, `/tm`, `/tp`, `/xp`) carried on the `aliases` of the command they
alias. Path A is usually just wiring.

---

## Path A — wire up a derived vanilla command

**1. Confirm the skeleton exists.**

```sh
pnpm gen:commands   # only if the file is missing or stale
```

Find the entry in `src/data/generated/<version>/commands.json` and read its nodes.

**2. Check its argument types.** Any argument bound to `raw_text` means derivation
met a parser with no authored editor. Either accept the text field for now, or add
the editor (below).

**3. Add presentation metadata** in `src/data/authored/ui/<command>.ts` — labels,
argument grouping, help text. Derivation cannot produce these; Brigadier has no
human-facing strings.

**4. Check the route.** There is nothing to add: `/c/$commandId` resolves any
definition in the generated set, so `/c/vanilla:give` works the moment the skeleton
exists. A command only needs a route entry of its own if it needs a page that is not
the workbench — and if it does, that is a finding about the design rather than a step
in this list.

**5. Add fixtures.** At minimum one expected output string per supported version,
in `<command>.test.ts`. Copy the style of the canonical examples in
[`minecraft-versions.md`](minecraft-versions.md) — and if the shape you are asserting
is not already one of them, verify it against a primary source and add a provenance
row there first. A fixture carries its evidence; an unverified one just records what
the code happened to do.

**6. Run `/suite-kit:health`.**

Do not edit the generated skeleton. If it is wrong, the deriver is wrong — fix
`scripts/derive-commands.ts` and regenerate.

---

## Path B — author a definition

Create `src/data/authored/commands/<dialect>/<name>.ts`.

**1. Write the definition.** Start from the `//generate` example in
[`command-schema.md`](command-schema.md), which exercises flags, a variadic tail,
and a constraint.

```ts
export const myCommand: CommandDefinition = {
  id: 'worldedit:sphere',
  label: '//sphere',
  dialect: 'worldedit',
  provenance: 'authored',
  versions: { min: '1.21.1' },
  aliases: [],
  root: { kind: 'sequence', nodes: [/* … */] },
}
```

**2. Model the structure with the right nodes.**

| Need                | Node       |
| ------------------- | ---------- |
| Fixed keyword       | `literal`  |
| User value          | `argument` |
| Ordered parts       | `sequence` |
| One-of alternatives | `choice`   |
| Repeatable clause   | `repeat`   |
| Boolean switches    | `flagset`  |
| Embedded command    | `ref`      |

**3. Express cross-argument rules as `constraints`**, not as editor logic. Mutually
exclusive flags are `kind: 'mutex'`. Constraints warn; they never block.

**4. Reuse argument types.** Check the type registry before adding a new one —
`entity_selector`, `block_pos`, `we_pattern` and the rest are shared across
dialects. A new type is only warranted for genuinely new input semantics.

**5. Register the definition** in the authored index.

**6. Add tests and run `/suite-kit:health`.**

---

## Adding an argument type

Only when no existing type fits.

Add to the argument-type registry:

```ts
{
  key: 'my_type',
  editor: MyTypeEditor,                    // React component
  serialize: (value, ctx) => string,       // ctx carries version traits
  validate: (value, options) => Diagnostic[],
  defaultValue: (options) => unknown,
}
```

Requirements:

- **Serialize from traits, never version numbers.** `ctx.traits.enchantmentsShape`,
  not `ctx.version === '1.21.1'`.
- **No hardcoded game values.** Read items, entities, and enchantments from the
  version registry passed in context.
- **Validation warns.** Return diagnostics; never throw, never block output.
- If the type maps to a Brigadier parser, register the mapping in
  `scripts/derive-commands.ts` so future derivations bind it automatically instead
  of falling back to `raw_text`.

---

## Checklist

- [ ] Definition is data, not a bespoke component
- [ ] Argument `name`s are unique within the definition
- [ ] Cross-argument rules are `constraints`, not editor logic
- [ ] No game values hardcoded outside `src/data/`
- [ ] Serializers branch on traits, not version numbers
- [ ] Generated files untouched
- [ ] Output fixtures added for every supported version
- [ ] `/suite-kit:health` passes
