---
paths:
  - src/data/authored/**
  - src/data/versions/**
---

# Authored command definitions and version data

**Why this rule exists:** this is where the architecture is most easily undone, and
the shortcuts are all locally reasonable. Special-casing one command in a component
is faster than modelling it. Comparing a version string is more obvious than
threading a trait. Both work, and both convert a data-driven system back into the
per-command codebase this design replaced.

## Commands are data, not code

A command is a `CommandDefinition`. Adding one means adding a definition — never a
bespoke page or a branch keyed on command id.

If a command seems to need custom component logic, the schema is missing something.
Extend the schema or the argument-type registry; do not special-case the command.
See `docs/command-schema.md`.

## Cross-argument rules belong in `constraints`

Mutual exclusion, dependencies, and numeric relationships are declared:

```ts
constraints: [
  { kind: 'mutex', targets: ['-r', '-o', '-c'], message: 'Choose one origin mode.' },
]
```

Not implemented as conditionals inside an editor. Constraints are inspectable,
testable, and shared across dialects; editor logic is none of those.

Constraints **warn, never block**. Output still renders — the user decides.

## Never compare version numbers

```ts
if (version === '1.21.1') { … }                        // wrong
if (traits.enchantmentsShape === 'levels-wrapper') { … } // right
```

A version comparison breaks silently the moment an adjacent version is added — the
attribute rename at 1.21.2 is exactly this failure. `/health-check` greps for it.

## Version definitions declare every trait explicitly

No inheritance, no defaults, no partial objects. A missing trait must be a type
error, not a silent fallback to another version's behaviour.

## No hardcoded game values

Item IDs, entities, enchantments, effects, particles, and attributes come from the
version registry. This directory holds *structure*; `src/data/generated/` holds
*content*.

Authored data that genuinely has no upstream source — selectors, colour codes,
WorldEdit patterns and masks — lives in `src/data/authored/` and is still versioned
data, never a literal in a component.

## Related

- `docs/command-schema.md` — the authoritative schema
- `docs/adding-a-command.md`
- `docs/minecraft-versions.md` — the trait matrix
