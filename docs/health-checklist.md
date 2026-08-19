# Health checklist

An evergreen yardstick for measuring project health across four pillars:
**Clean, Correct, Scalable/Future-proof, Performant.** Run it before each roadmap
phase closes (Now → Next), or roughly monthly.

**How to use this doc:** compare the current codebase against the items below. Do
**not** edit this list to match whatever the code currently does — it is the target,
not a snapshot. When a gap is found, track it under `Open backlog` (or as a GitHub
issue), fix it, then re-run. This file should look almost the same every time it is
opened; only `Open backlog` should churn.

Most boxes are unticked because the code they describe does not exist yet. That is
the point of writing the checklist alongside the scaffold rather than after the
codebase: the items are what each piece has to satisfy on arrival, so they are read
before the code is written rather than as an audit afterwards.

See [`architecture.md`](architecture.md) for how the system fits together and
[`roadmap.md`](roadmap.md) for scope. This doc duplicates neither — it is the quality
gate that sits alongside them.

---

## The mechanical layer

Every check below that a machine can run is declared in
[`.claude/suite.json`](../.claude/suite.json) and run together by `/suite-kit:health`,
which reports them as a table:

```bash
pnpm lint            # eslint src scripts
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest run
pnpm format:check    # prettier --check .
```

Plus three `invariants` — greps that must find nothing — and one `generated` entry:
`pnpm gen:tokens` followed by a clean-diff check on `src/styles/tokens.css`. A
non-empty diff means the generated file was hand-edited (the next run reverts it) or
`tokens.source.json` was refreshed without regenerating.

Where the plugin is not installed — CI, a cloud container, an unattended agent —
[`.claude/suite-check.py`](../.claude/suite-check.py) reads the same manifest and runs
the same three sections. `--json` for one record per check, `--require-runnable` to
turn a skip into a failure. CI runs it with that flag on every push.

**A skip is never a pass.** The runner says so on every run, and it is the whole
reason the file exists: for most of this repo's life all nine declared checks reported
`skip`, which is indistinguishable from green unless something states it out loud.

Read an invariant's `diagnosis` before judging a match, and when a match is
legitimate, **encode it** — add to that entry's `exclude` or sharpen its `grep`. A
decision made once in a session is invisible to CI and to the next session.

---

## 1. Clean

- [x] `pnpm lint` runs against a real ESLint config and passes with zero warnings.
- [x] `pnpm typecheck` has zero errors.
- [x] Formatting is Prettier-enforced, not manual, and the **whole tree** is clean —
      `pnpm format:check` covers docs and config, not just `src/`. Non-default
      settings are in [`CLAUDE.md`](../CLAUDE.md) § Conventions.
- [ ] No `any` anywhere — use `unknown` and narrow. Every exception carries a
      comment saying which upstream type is wrong.
      Verify: `grep -rnE ':\s*any\b|<any>|as any' src scripts` — expect no matches.
- [x] No literal hex or px in `src/components/**` or `src/routes/**`. Enforced by the
      `no literal hex or px in components` invariant.
- [x] No inline `style={{}}` beyond genuinely computed values (transforms, animation
      delays). Enforced as an ESLint error across `src/**`, with no per-directory
      allowlist, so a new file is covered the moment it exists. Justified exceptions
      carry a documented `eslint-disable-next-line`.
- [ ] New transition durations and easing curves reuse an existing
      `--duration-*`/`--ease-*` token. The token layer is **generated**, so the gate
      is "reuse a token", never "edit one" — a new value is an upstream
      `kollektiv/design/tokens.json` edit followed by `pnpm gen:tokens`. This is not
      "all motion must look identical": a snappy hover and a panel slide legitimately
      differ. The goal is a shared vocabulary for the common cases.
      Verify: `grep -rnE '(duration|delay)-\[[0-9.]+m?s\]|ease-\[' src` — every match
      must be a documented one-off, not a near-miss of an existing token.
- [x] Generated output is never hand-edited. `src/styles/tokens.css` carries a
      DO-NOT-EDIT header and a clean-diff check; `src/data/generated/**` will carry
      the same. See [`.claude/rules/generated-data.md`](../.claude/rules/generated-data.md).
- [x] No committed build artifacts — `.gitignore` covers `dist/`, `node_modules/`,
      and caches, and deliberately does **not** cover `src/data/generated/`,
      `tokens.source.json`, or `src/styles/tokens.css`.
- [ ] The docs still describe the real tree. Each fact lives in exactly one file
      ([`CLAUDE.md`](../CLAUDE.md)); a fact stated twice is a fact that will drift.
      Verify: read CLAUDE.md's command table against `package.json`'s `scripts`, and
      its docs table against `ls docs/`.
- [ ] No dead code left after a refactor — unused exports, orphaned files.
      Verify: for each file the last refactor touched, `grep -rn "<exported name>" src`;
      an export with no importer outside its own file is dead.

## 2. Correct

This pillar replaces Konnekt's _Stable_. Kommands has no processes to supervise and
no sockets to time out; it emits text. Its failure mode is **a command that looks
right and silently does nothing in game** — so correctness of emitted syntax is what
belongs here.

- [x] Every canonical fixture in [`minecraft-versions.md`](minecraft-versions.md)
      § Canonical 1.21.1 output generates **byte-exact**. All four `/give` fixtures are
      asserted in `src/schema/argument-types/item-stack.test.ts`, against the _derived_
      skeleton rather than a transcription of it, so a deriver change that reshapes
      `/give` fails there too. `/tellraw`'s is asserted in `serialize.test.ts` — its
      editor is #8's, but its argument type is not — and separately from the
      `custom_name` form, because a component written as an argument is bare and the
      same component written into a data-component field is a quoted string. Only
      `/execute`'s remains, with #9. These are regression fixtures: a serializer change
      that breaks one is wrong, not the fixture.
      Verify: `pnpm test` — each must be an assertion, not a comment.
- [x] Every fixture has been checked against a **primary source** —
      [minecraft.wiki](https://minecraft.wiki) or the pinned mcmeta data — not against
      training data or a third-party tutorial. 1.21.1 sits between two breaking
      changes and is easy to get wrong in both directions; third-party examples
      routinely mix eras. Use `/suite-kit:mc-syntax`.
- [x] No game value appears as a literal outside `src/data/`. Enforced by the
      `no hardcoded game values` invariant. Item IDs, entities, enchantments,
      effects, particles and attributes are versioned data — an item that exists in
      1.21.1 may not exist in another version.
- [x] No serializer branches on a version number, **in any form**. Two layers:
      the `no version-number comparisons` invariant catches
      `version === '1.21.1'`, and an ESLint rule catches the shapes a regex
      structurally cannot see — `.startsWith('1.21')`, `.includes(…)`, relational
      operators, an identifier not spelled `version`, and any `semver` import.
      One shape is still uncovered; see `Open backlog`.
      Verify: `pnpm lint` and the invariant, together. Neither alone is sufficient.
- [x] Version definitions declare **every** trait explicitly — no inheritance, no
      defaults, no partials. A missing trait must be a type error, not a silent
      fallback to another version's behaviour.
- [ ] Registries are pinned per version by mcmeta **tag**, never by branch, and
      never merged across versions. Entries are removed as well as added — 31 of 31
      attributes were renamed at 1.21.2 — so a shared "latest" registry would offer
      values that do not exist in the target version.
      Verify: `grep -rn "mcmeta" scripts` — every URL must carry a version tag.
- [x] Validation **warns, never blocks**. Output always renders; the user decides.
      A validator that throws, or a diagnostic that gates the output panel, is the
      failure.
- [x] The renderer never branches on command id. If a command appears to need custom
      component logic, the schema is missing something — extend the schema, not the
      renderer.
      Verify: `grep -rnE "id === '|definitionId === '" src/components src/routes` —
      expect no matches.
- [x] A `Ref` never resolves to its own definition without passing through a
      `Repeat`. Otherwise rendering does not terminate.
- [ ] Tests exist and pass for the paths where a silent wrong answer is possible:
      each serializer, the trait branches, the deriver's parser mapping, and the
      WorldEdit expression evaluator's golden fixtures. Partly: all three trait
      branches now have a branch site and a test, the parser table and the SNBT writer
      are covered, and the deriver is asserted through its committed artefact. The
      evaluator does not exist yet.

## 3. Scalable / future-proof

- [x] Adding a vanilla command touches **only** data, presentation metadata, and a
      route — never the renderer, never a new page component. This is the design's
      load-bearing claim; if it starts requiring code changes, surface it rather than
      absorbing the cost. There is now one dynamic route for all 78, so a command
      needs no route entry of its own: `src/data/authored/ui/<command>.ts` and a test
      are the whole diff. `/give` itself is not the evidence — it brought the
      `item_stack` argument type with it, which
      [`architecture.md`](architecture.md) buckets as authored editor code by design.
      The next command is the test of this claim.
      Verify: `git diff` for the last command added — expect
      `src/data/authored/ui/` and a test. Nothing else.
- [ ] Adding a Minecraft version touches only version data and generated files.
      Adding 1.21.5 flips three trait flags; 1.21.2 flips none. Neither touches
      serializer control flow.
- [x] Routes are assembled from definitions rather than generated per command. A file
      per command reintroduces exactly the per-command cost
      [`architecture.md`](architecture.md) § The constraint rules out.
- [ ] Three.js and every preview module are lazily imported and stay out of the entry
      chunk. The abstraction is eager; the code is lazy.
      Verify: `pnpm build`, then confirm `three` lands in its own chunk.
- [ ] Preview modules receive **parsed argument values, never the command string**.
      A module that parses text depends on the serializer and on version traits, and
      breaks whenever syntax changes. See
      [`.claude/rules/previews.md`](../.claude/rules/previews.md).
- [ ] Preview `inputs` are validated at **build time** against real argument names
      and types, so a typo fails the build rather than rendering an empty canvas.
- [ ] Dependencies are reasonably current, with nothing unmaintained and nothing
      duplicated doing the same job.
      Verify: `pnpm outdated`, and `pnpm why <pkg>` for anything suspected of being
      vendored twice.
- [x] The lint and format toolchain tracks Konnekt's majors. Both products consume
      the same token source and the same conventions; letting the two formatters
      drift apart produces diff noise that looks like real change.

## 4. Performant

- [ ] Registry files load on demand rather than in the entry chunk — 1.21.1 is
      640 KB of registries and 230 KB of block states.
      Verify: `pnpm build`, then confirm neither lands in the entry chunk.
- [ ] The command output panel recomputes only when a value it depends on changes,
      not on every keystroke anywhere in the tree.
- [ ] Preview recomputation is debounced by the module, not by the canvas, and uses
      instanced geometry. A 64³ region is 262,144 candidate positions.
- [ ] The evaluated preview volume is **capped, and the cap is surfaced in the UI**
      rather than freezing the tab.
- [ ] Geometries and materials are disposed on unmount. A module that creates its own
      renderer produces a second WebGL context and leaks it.
- [ ] The WorldEdit expression evaluator compiles to a closure tree rather than
      walking the AST per voxel, and has been benchmarked before being wired to a
      canvas.
- [ ] There is an agreed production bundle budget, checked in CI. Konnekt runs a
      550 KB gzip entry-chunk budget via `pnpm check-bundle`; Kommands has no
      equivalent yet — see `Open backlog`.

---

## Open backlog

The not-yet-closed follow-ups. Keep this section short and current; everything above
it should be stable between runs.

**P2 — The version-comparison guard cannot see a named constant**

- Two layers cover version-number branching: the `no version-number comparisons`
  grep, and an ESLint rule that catches `.startsWith('1.21')`, `.includes(…)`,
  relational operators, an identifier not spelled `version`, and `semver` imports.
  Neither can catch `version === TARGET_VERSION`, because resolving the constant
  needs type information no selector or regex has. A type-aware lint rule
  (`typescript-eslint` with `projectService`) could, at the cost of a slower lint
  run. Worth revisiting once serializer code exists and the shape of the risk is
  concrete rather than hypothetical. Originally
  [#16](https://github.com/kollektiv-mc/Kommands/issues/16).

**P2 — `attribute_modifiers` hard-codes this version's wrapper**

- At 1.21.1 the component is `{modifiers:[…],show_in_tooltip?}`; from 1.21.5 it is a
  bare array. No trait describes that, and adding a fourth flag means editing the
  authoritative matrix in [`minecraft-versions.md`](minecraft-versions.md) — a
  decision worth making on its own rather than inside #7. Until then, adding 1.21.5
  is a serializer change rather than a data change, which is the one thing the version
  model exists to prevent. `enchantments` is not affected: its own change rides
  `enchantmentsShape`, which already exists.
  [#26](https://github.com/kollektiv-mc/Kommands/issues/26).

**P2 — An unset required argument in the middle of a sequence emits a double space**

- `serialize.ts` pops trailing empties, so an unfilled optional tail disappears
  cleanly. A gap in the _middle_ survives `parts.join(' ').trim()` as two spaces —
  `give @p  1` when no item has been picked. The comment there says the gap is
  deliberately visible, and it should be; a doubled space is not visible, it is
  malformed text a user will paste. The fix is probably a placeholder token for an
  unset required argument, which is a design change rather than a patch.
  [#27](https://github.com/kollektiv-mc/Kommands/issues/27).

---

When a backlog item closes, delete it here. If the write-up is worth keeping —
because the reasoning would otherwise have to be rediscovered — start a
`docs/health-log.md` and move it there, the way Konnekt splits
`agent_docs/HEALTH_LOG.md` out of its checklist. There is nothing to move yet.
