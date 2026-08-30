# The suite

Kommands is one of two products built to the same taste on a partly shared stack.
The other is **Konnekt** — a Wails desktop dashboard for Minecraft servers.

They are separate repositories with separate release cycles, and they stay that
way. What they share is conventions, domain knowledge, and agent tooling — held in
an umbrella repository, **[kollektiv](https://github.com/kollektiv-mc/Kollektiv)**.

---

## Why an umbrella and not a monorepo

The two products have **separate release cycles and unrelated failure modes**.
Konnekt ships versioned binaries and an `.rpm` off `v*` tags; Kommands deploys a web
build continuously and, once [#44](https://github.com/kollektiv-mc/Kommands/issues/44)
lands, cuts desktop releases on its own schedule. Merging them would put both behind
one CI run, so a Kommands doc change would gate a Konnekt release, and a Konnekt
platform failure would block a web deploy that shares nothing with it.

This argument used to be made as "Konnekt is a Go module, Kommands is a Vite app."
That was never the real reason and is no longer even true: Kommands' standalone build
is a Wails v2 app, so both products are a Go shell around a web frontend, deliberately
— see [`distribution.md`](distribution.md) § The shell is Wails v2. The toolchains
converging is a **reason to share more**, not a reason to merge. What converged is the
shell; what stayed separate is everything either product releases.

What _is_ genuinely shared is narrower and more valuable:

- **The design language.** Both use the same CSS-custom-property token system with
  runtime theme overrides. The source is `kollektiv/design/tokens.json`; both
  products are consumers. Neither product defines the set, and neither reads the
  other's — see [`design-tokens.md`](design-tokens.md).
- **The rule that no game value is ever a literal.** Both emit Minecraft commands.
  Both are exposed to the same failure mode — training data on Minecraft syntax is
  frequently stale, and a wrong identifier produces a command that looks right and
  silently does nothing.
- **The health-check discipline.** Run every check, report a table, never report a
  skipped check as passing.

Those three are conventions, not code. They travel as a Claude Code plugin.

---

## Layout

The umbrella repo is the **workspace root**. Cloning it and running its
`scripts/bootstrap.sh` clones the products as siblings beneath it:

```
kollektiv/
  design/tokens.json    ← the suite's single source of design values
  plugins/suite-kit/    ← the shared plugin
  Konnekt/              ← independent repo, cloned, not tracked
  Kommands/             ← this repo
```

The products are untracked clones, not submodules. Nothing about a product's git
history, CI, or release process is owned by the umbrella.

Tokens are **vendored, not referenced**: `kollektiv/scripts/sync-tokens.sh` copies
`design/tokens.json` into each product as `tokens.source.json`, which is committed.
A build therefore works from a standalone clone, with no `kollektiv` checkout
beside it.

---

## `suite-kit`

A Claude Code plugin published from the umbrella's own marketplace. It supplies
what both products need identically:

| Skill                      | What it does here                                                        |
| -------------------------- | ------------------------------------------------------------------------ |
| `/suite-kit:health`        | Runs the checks declared in `.claude/suite.json`                         |
| `/suite-kit:mc-syntax`     | Verifies syntax against mcmeta before a serializer is written or changed |
| `/suite-kit:design-tokens` | The no-literal-hex, no-literal-px rule                                   |
| `/suite-kit:suite-sync`    | Mirrors the suite's GitHub Issues into Linear                            |

Per-repo configuration lives in [`.claude/suite.json`](../.claude/suite.json) —
product name, stack kind, tracking mode, roadmap path, and the full health
manifest. The plugin's skills are generic and read that file; the invariants
themselves stay here, where they can be reviewed alongside the code they
constrain.

`.claude/rules/*.md` are **not** replaced by the plugin. They are path-scoped and
auto-inject when a matching file is edited, which a plugin skill does not do.

suite-kit ships no hooks, deliberately — Konnekt already binds `graphify
hook-guard` to `PreToolUse`, and stacking more matchers is the fastest way to make
both feel broken.

---

## Setup

The marketplaces and plugins are declared in `.claude/settings.json`, so a clone
picks them up. Add this block if it is not present yet:

```json
"extraKnownMarketplaces": {
  "kollektiv": { "source": { "source": "github", "repo": "kollektiv-mc/Kollektiv" } },
  "superpowers": { "source": { "source": "github", "repo": "obra/superpowers" } }
},
"enabledPlugins": {
  "suite-kit@kollektiv": true,
  "superpowers@superpowers": true
}
```

Declaring a plugin does not install it. Claude Code prompts on first run with a
`claude plugin install` line — run it once per machine.

[superpowers](https://github.com/obra/superpowers) is the one third-party plugin
the suite enables. Plugins cost context on every turn, so check the **Context
cost** figure in the `/plugin` detail view before adding another repo-wide.

---

## Tracking

**GitHub Issues is the source of truth**, in this repo's own issue tracker,
declared as `"tracking": "github-issues"` in `.claude/suite.json`. Every repo in
the suite does the same.

Linear is a **downstream mirror**, written only by `/suite-kit:suite-sync`. Never
write to it directly from this repo. Kommands mirrors into the **Apps** team's
**Kommands** project, with milestones `Now` / `Next` / `Later` matching this
repo's [`roadmap.md`](roadmap.md) headings. `Done` is a heading there but not a
milestone — completed work is closed, not mirrored into a fourth column.

Close issues with GitHub's own magic words in a PR title or description:

```
Fixes #12      Closes #9      Resolves #28
```

That closes the GitHub issue on merge, and the next sync run carries it to Done in
Linear.

The full cross-repo picture — the label taxonomy, the Linear structure, the
GitHub↔Linear match key — is documented once, in kollektiv's `docs/conventions.md`
and `docs/linear.md`.
