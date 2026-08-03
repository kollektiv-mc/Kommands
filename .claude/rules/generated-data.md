---
paths:
  - src/data/generated/**
  - src/styles/tokens.css
  - scripts/**
---

# Generated data and the generators that produce it

**Why this rule exists:** these files look editable and are not. The normal instinct
on finding a wrong value in a checked-in file is to correct it in place — here that
correction is silently destroyed on the next `pnpm gen`, and the underlying bug
survives. The files are committed (for reviewable version diffs and offline builds),
which makes them look hand-maintained. They are not.

## Never edit generated output

`src/data/generated/**` and `src/styles/tokens.css` are produced by `pnpm gen`.
Every file carries a DO-NOT-EDIT header.

If a generated value is wrong, the **generator** is wrong. Fix
`scripts/derive-commands.ts` or `scripts/gen-tokens.ts`, regenerate, and commit the
generator change together with its regenerated output.

## Regeneration is deterministic

Same mcmeta tag in, same bytes out. A generated file changing without a
corresponding generator or version change means something is wrong — investigate
rather than committing the diff.

mcmeta is always pinned by version tag (`1.21.1-summary`), never by branch. A
branch reference would make output depend on when the build ran.

## Derivation failure policy

Deliberately asymmetric — do not "simplify" it into one behaviour:

- **Unmapped shallow parser → hard error.** Scalars such as integers and booleans
  must be generically representable. Failing to map one means the deriver does not
  understand a scalar type, which would produce broken definitions across many
  commands.
- **Unmapped deep parser → warn, bind `raw_text`, record the gap.** Deep parsers
  need hand-authored editors that may not exist yet. A command degrading to a text
  field is acceptable; a failed build is not.

Never silently skip a node. A skipped node produces a definition that looks valid
and generates invalid commands.

## Scope of derivation

All 83 vanilla commands are emitted, not only those with routes. Emitting the full
tree is one walk and costs nothing extra; narrowing it would reintroduce per-command
work every time a command is added.

## Related

- `docs/architecture.md` § Derivation
- `docs/adding-a-version.md`
