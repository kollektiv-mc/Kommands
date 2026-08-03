---
description: Run lint, typecheck, tests, and the architectural invariant checks
---

# Health check

Run every check below and report results as a table. **Do not stop at the first
failure** — run all of them, then report. A partial run hides compounding problems.

If a check cannot run yet (the app is not scaffolded, a script does not exist),
report it as `skipped` with the reason. Never report a skipped check as passing.

---

## 1. Standard checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

---

## 2. No hardcoded game values

Minecraft identifiers are versioned data. They must not appear as literals outside
`src/data/`.

```sh
rg -n "minecraft:[a-z_]+" src --glob '!src/data/**'
```

**Expect no matches.** A hit means a game value was inlined instead of being read
from the version registry.

Legitimate exception: a string that is part of a *serializer format*, such as the
`minecraft:` namespace prefix being constructed. Judge by whether the specific
entity, item, or enchantment is named — `'minecraft:'` alone is fine,
`'minecraft:diamond_sword'` is not.

---

## 3. No version-number comparisons

Serializers branch on traits, never on version numbers.

```sh
rg -n "version\s*[=!]==?\s*['\"]1\.[0-9]" src
```

**Expect no matches.** A hit is the failure mode that the 1.21.2 attribute rename
would trigger — see `docs/minecraft-versions.md`.

---

## 4. No literal hex or px in components

```sh
rg -n "#[0-9a-fA-F]{3,8}\b" src/components src/routes
rg -n "\[[0-9.]+px\]" src/components src/routes
```

**Expect no matches in either.** Every value has a named token; see
`docs/design-tokens.md`. The fix is to add a token, never to inline or approximate.

---

## 5. Generated files unmodified

Generated output must match what the generators produce.

```sh
pnpm gen
git diff --exit-code src/data/generated src/styles/tokens.css
```

**Expect a clean diff.** A non-empty diff means either a generated file was
hand-edited, or a generator change was committed without its regenerated output.
Both are bugs — see `.claude/rules/generated-data.md`.

Note this step needs network access to fetch mcmeta. If offline, report it as
skipped rather than failed.

---

## Reporting

| Check | Result |
|---|---|
| lint | |
| typecheck | |
| tests | |
| format | |
| no hardcoded game values | |
| no version comparisons | |
| no literal hex/px | |
| generated files clean | |

For each failure, give the file and line and a one-line diagnosis. Do not fix
anything unless asked — report first.
