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
pnpm lint                        # eslint src scripts
pnpm typecheck                   # tsc --noEmit
pnpm test                        # vitest run
pnpm format:check                # prettier --check .
pnpm build && pnpm check-bundle  # entry-chunk gzip budget
```

Plus three `invariants` — greps that must find nothing — and two `generated` entries:
`pnpm gen:commands` followed by a clean-diff check on `src/data/generated`, and
`pnpm gen:tokens` followed by the same check on `src/styles/tokens.css`. A non-empty
diff means the generated file was hand-edited (the next run reverts it) or its input —
the pinned mcmeta tag, or `tokens.source.json` — was refreshed without regenerating.
Only the first declares `requiresNetwork`, and only for a cold `.cache/mcmeta`.

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
      DO-NOT-EDIT header, and both it and `src/data/generated/**` carry a clean-diff
      check — one `generated` entry each in `.claude/suite.json`, so a hand edit fails
      the gate rather than surviving until the next regeneration reverts it.
      See [`.claude/rules/generated-data.md`](../.claude/rules/generated-data.md).
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
      `/give` fails there too. All three `/tellraw` fixtures are asserted in
      `serialize.test.ts`, and separately from the `custom_name` form, because a
      component written as an argument is bare and the same component written into a
      data-component field is a quoted string. `/execute`'s is asserted there too,
      against the derived skeletons of both `/execute` and `/particle`, so the embedded
      command is the real one rather than a stand-in — and it is the fixture that found
      the optional-clause gap, because until `ChoiceNode` could say "or none" it
      generated two tokens too many. All eight now assert. These are regression
      fixtures: a serializer change that breaks one is wrong, not the fixture.
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
- [x] Tests exist and pass for the paths where a silent wrong answer is possible:
      each serializer, the trait branches, the deriver's parser mapping, and the
      WorldEdit expression evaluator's golden fixtures. All three trait branches have
      a branch site and a test, the parser table and the SNBT writer are covered, the
      text-component grammar is asserted in both of its forms, the deriver is asserted
      through its committed artefact, the path model has its own suite, and the
      WorldEdit pattern grammar is asserted against the rules read out of
      `RandomPatternParser`. The evaluator was the last of them, and the one where a
      silent wrong answer was likely rather than merely possible, so its corpus is
      **transcribed** from `ExpressionTest.java` and `RealExpressionTest.java` rather
      than paraphrased: a case that disagrees with upstream is this implementation
      being wrong, not the case. The four traps are why that distinction earns its
      keep — `^` is power rather than xor, postfix `!` is factorial, `&&`/`||` return
      an operand rather than a boolean, `~=` compares by ULPs — each one something an
      implementation written from intuition gets wrong while passing everything else.
      The CSG compiler and the AST printer are the two since, and both are checked
      against something rather than against expectations. The printer round-trips the
      whole of that same corpus, so cases written to specify the language also specify
      it. The compiler is checked against `reference.ts`, a second and deliberately
      naive implementation that shares nothing with it — 200 seeded graphs and 7 named
      ones, bit-exact at 265 points each, because the reference mirrors the emitted
      arithmetic operator for operator rather than comparing within a tolerance that
      would hide a boundary error. `simplify.ts` is checked the same way, before and
      after, which is the only thing that catches a rewrite rule that is quietly wrong.
      The named graphs are not decoration: dropping the coordinate frame from the
      compiler's memo key — the exact bug its sharing design is about — leaves all 200
      generated graphs passing, and only the fixture written for it fails.
      Verify: `pnpm test`.

## 3. Scalable / future-proof

- [x] Adding a vanilla command touches **only** data, presentation metadata, and a
      route — never the renderer, never a new page component. This is the design's
      load-bearing claim; if it starts requiring code changes, surface it rather than
      absorbing the cost. There is now one dynamic route for all 78, so a command
      needs no route entry of its own: `src/data/authored/ui/<command>.ts` and a test
      are the whole diff. `/give` itself is not the evidence — it brought the
      `item_stack` argument type with it, which
      [`architecture.md`](architecture.md) buckets as authored editor code by design.
      `/execute` did **not** hold to this and was not expected to: it cost a schema
      field (`ChoiceNode.optional`), a deriver branch, and the Ref rendering #9 had
      deferred. That is the claim behaving correctly rather than failing — `/execute`
      is in the acceptance set precisely because it stresses the schema, and what it
      found was a gap in the schema rather than a command needing special-casing.
      `//generate` is the closest thing to a clean test so far, and came nearer to
      holding: no new node kind, no second schema, no renderer change — a definition,
      two argument types, and one merge. Two argument types is more than the claim
      allows, but [`architecture.md`](architecture.md) buckets authored editors that
      way by design, the same allowance `/give` took for `item_stack`. The renderer
      still branches on node kind alone.
      Verify: `git diff` for the last command added — expect
      `src/data/authored/ui/` and a test. Nothing else.
- [ ] Adding a Minecraft version touches only version data and generated files.
      Adding 1.21.5 flips two of the three trait flags; 1.21.2 flips none. Neither
      touches serializer control flow.
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
      **Half done.** Invariant 7 covers the names: `definitionProblems` requires every
      `inputs` entry to resolve to exactly one node, over the whole catalogue, and
      reports the qualified selector to use when it does not. The _types_ half — a
      module's `accepts` asserting the argument types it depends on, per
      [`adding-a-preview.md`](adding-a-preview.md) — needs the preview registry and is
      still open under #12. A box half-ticked is not ticked.
- [ ] Dependencies are reasonably current, with nothing unmaintained and nothing
      duplicated doing the same job.
      Verify: `pnpm outdated`, and `pnpm why <pkg>` for anything suspected of being
      vendored twice.
- [x] The lint and format toolchain tracks Konnekt's majors. Both products consume
      the same token source and the same conventions; letting the two formatters
      drift apart produces diff noise that looks like real change.

## 4. Performant

- [ ] Registry files load on demand rather than in the entry chunk — 1.21.1 is
      660 KB of registries and 260 KB of block states.
      Verify: `pnpm build`, then confirm neither lands in the entry chunk.
- [ ] The command output panel recomputes only when a value it depends on changes,
      not on every keystroke anywhere in the tree.
- [ ] Preview recomputation is debounced by the module, not by the canvas, and uses
      instanced geometry. A 64³ region is 262,144 candidate positions.
- [ ] The evaluated preview volume is **capped, and the cap is surfaced in the UI**
      rather than freezing the tab.
- [ ] Geometries and materials are disposed on unmount. A module that creates its own
      renderer produces a second WebGL context and leaks it.
- [x] The WorldEdit expression evaluator compiles to a closure tree rather than
      walking the AST per voxel, and has been benchmarked before being wired to a
      canvas. `compile.ts` binds every operand at compile time; `evaluate` dispatches
      on nothing. A 64³ torus is 262,144 evaluations in ~56 ms, the heaviest fixture
      (a gyroid) ~196 ms, and `evaluate.test.ts` holds a 400 ms floor so the next
      change fails loudly rather than quietly costing 10×.
      Verify: `pnpm vitest bench src/worldedit/expression`.
- [x] What the CSG compiler emits is no more expensive to evaluate than an equivalent
      expression written by hand, and compiling is cheap enough to do on every edit.
      Both are benched, because they are different questions and the second one is the
      one that matters: compiling happens once per edit, evaluating happens 262,144
      times. A twenty-operation sculpt compiles in **~0.9 ms** and its output evaluates
      at 64³ in **~180 ms** — the same range as the gyroid above, which is a
      hand-written fixture of comparable depth. So the frame model and the sharing are
      not buying shorter text at the evaluator's expense. Length is ratcheted separately
      in `compile.test.ts`, since a compiler can also fail by emitting something
      enormous that happens to evaluate quickly.
      Verify: `pnpm vitest bench src/worldedit/csg`.
- [x] A compiled expression carries a **step budget** and stops with a diagnostic. The
      language has `while` and `for`, so a formula that does not terminate is a thing
      a user can type; without the guard it hangs the tab rather than the evaluation.
      This is the headless half of capping the evaluated volume.
- [x] There is an agreed production bundle budget, checked in CI. 120 KB gzip on the
      entry chunk, via `pnpm check-bundle`, run by `.github/workflows/ci.yml` on every
      push. Currently 103.7 KB. Konnekt's equivalent is 550 KB, and the gap is the
      point: this app's data is lazy and Konnekt's is not.
      Verify: `pnpm build && pnpm check-bundle`.

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

**P2 — Two schema fields are documented and read by nothing**

- `ArgumentNode.default` and `RepeatNode.max` exist in the type and in
  `command-schema.md`, and no code in `src/` reads either. A documented field with no
  behaviour reads as a guarantee, which is worse than an absent one. `variadic` was the
  third and is now real: it reaches the editor through `argumentOptions`, and invariant
  6 — nothing may follow a variadic argument — is checked against every definition in
  the catalogue. `CommandDefinition.versions` has since joined the list: the catalogue
  merges without consulting it, because with one version a range check would be
  untestable code standing in for a decision nobody has had to make yet.
  [#30](https://github.com/kollektiv-mc/Kommands/issues/30).

**P1 — A reordered clause takes its values but not its component state**

- Repeat instances are addressed by index and rendered with `key={i}`, so
  `reindexInstances` moves every stored value while React hands the same mounted
  components new props. An editor holding internal state — `ItemStackEditor`'s
  component dropdown is one — keeps it at the old position, and focus is bound to a
  DOM slot rather than to a clause. Latent today, because `/execute`'s Repeat is the
  only one in the catalogue and none of its clauses uses such an editor. It stops
  being latent the moment the `/execute` editor becomes the intended lock-in-place
  node editor, where per-node local state is the norm and reorder is the primary
  interaction. The decision is where instance identity lives.
  [#33](https://github.com/kollektiv-mc/Kommands/issues/33).

**P2 — `^` associativity is pinned here and by nothing upstream**

- `^` is **left**-associative and binds looser than every prefix operator, so `2^3^2` is
  64 and `-2^2` is 4 — both the reverse of ordinary convention, and both wrong here until
  the grammar was read rather than assumed. The fix is safe because it is not a judgement
  call: `powerExpression`'s operands are typed `unaryExpression`, which cannot climb back
  to `powerExpression` except through parentheses, so the other readings are _underivable_
  rather than merely unselected. But upstream has no test pinning either — every `^` in
  `ExpressionTest`/`RealExpressionTest` has an atomic or parenthesised base, and the one
  negative exponent is written `^(-2)`. So this reimplementation is now stricter than its
  reference, and an upstream regression would not be caught by upstream. The trap is worth
  naming for anyone porting a formula from Python, Haskell or calculator notation, where
  both answers differ.

**P2 — `perlin`, `voronoi` and `ridgedmulti` are diagnosed rather than evaluated**

- The evaluator covers the language except its three noise functions, which come from
  `jlibnoise` (`worldedit-core/build.gradle.kts:38`) and have to be ported exactly — an
  approximation would draw a shape the command does not produce, which is worse than
  drawing nothing. Upstream has no tests for them either, so the port has to be checked
  against the Java by reading it rather than by running a corpus. Today they parse,
  compile, and report honestly that the preview cannot draw them, so the command still
  generates and copies. The right time to do the port is once the preview exists and the
  difference between right and nearly-right is visible on screen. This outlives
  [#11](https://github.com/kollektiv-mc/Kommands/issues/11), which the evaluator
  otherwise closes.

**P2 — The expression evaluator ships in the entry chunk, for every command**

- Wiring `we_expression`'s validator to the real evaluator moved the entry chunk from
  98.4 KB to 103.7 KB gzip. That is inside the 120 KB budget with 16.3 KB spare, and it
  is the price of the field telling the truth as you type — but the cost is paid by
  someone who only ever opens `/give`. The cause is structural rather than local: the
  argument-type registry in `argument-types/index.ts` is one eagerly-constructed object,
  so every type's validator, editor and serializer is statically reachable from every
  route. Making one lazy means an async validator, which changes the contract for
  every type in the registry. The right time to decide is when the preview lands and the same module
  is wanted lazily by a canvas — splitting the whole `we_expression` type, editor
  included, is a cleaner cut than special-casing its validator.

**P2 — `gen:diff` can pin to a branch**

- Every path that feeds the build pins by mcmeta tag, and a test asserts it. `gen-diff`
  passes an unrecognised argv string straight through as a ref, and `fetchSummary`
  then caches it permanently, so one typo fetches a moving branch and freezes that
  snapshot. Nothing shipped is wrong — `gen:diff` only reports — but the guarantee has
  a hole, and the guard belongs in `fetchSummary`, which owns the cache.
  [#31](https://github.com/kollektiv-mc/Kommands/issues/31).

---

When a backlog item closes, delete it here. If the write-up is worth keeping —
because the reasoning would otherwise have to be rediscovered — start a
`docs/health-log.md` and move it there, the way Konnekt splits
`agent_docs/HEALTH_LOG.md` out of its checklist. There is nothing to move yet.
