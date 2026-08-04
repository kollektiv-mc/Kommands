# The suite

Kommands is one of two products built to the same taste on a partly shared stack.
The other is **Konnekt** — a Wails desktop dashboard for Minecraft servers, and the
project this repo's entire visual language is derived from (see
[`design-tokens.md`](design-tokens.md)).

They are separate repositories with separate release cycles, and they stay that
way. What they share is conventions, domain knowledge, and agent tooling — held in
an umbrella repository, **kollektiv**.

---

## Why an umbrella and not a monorepo

The two products share almost nothing at the build layer. Konnekt is a Go module
with `wails generate module` bindings, a `550 KB` gzip bundle budget, and a `v*`
tag-driven release workflow that publishes binaries and an `.rpm`. Kommands is a
Vite app whose data is derived from pinned mcmeta tags. Merging them would put two
unrelated toolchains behind one CI run and break Konnekt's release pipeline for no
gain.

What *is* genuinely shared is narrower and more valuable:

- **The design language.** Both use the same CSS-custom-property token system with
  runtime theme overrides. Konnekt is the source; Kommands is the consumer.
- **The rule that no game value is ever a literal.** Both emit Minecraft commands.
  Both are exposed to the same failure mode — training data on Minecraft syntax is
  frequently stale, and a wrong identifier produces a command that looks right and
  silently does nothing.
- **The health-check discipline.** Run every check, report a table, never report a
  skipped check as passing.

Those three are conventions, not code. They travel as a Claude Code plugin.

---

## Layout

The umbrella repo is the **workspace root**. Cloning it and running its bootstrap
script clones the products as siblings beneath it:

```
kollektiv/
  .omc-workspace        ← marks the whole tree as one Oh-My-ClaudeCode workspace
  plugins/suite-kit/    ← the shared plugin
  Konnekt/              ← independent repo, cloned, not tracked
  Kommands/             ← this repo
```

The products are untracked clones, not submodules. Nothing about a product's git
history, CI, or release process is owned by the umbrella.

---

## `suite-kit`

A Claude Code plugin published from the umbrella's own marketplace. It supplies
what both products need identically:

| Skill | What it does here |
|---|---|
| `/suite-kit:health` | Runs the checks declared in `.claude/suite.json` |
| `/suite-kit:mc-syntax` | Verifies syntax against mcmeta before a serializer is written or changed |
| `/suite-kit:design-tokens` | The no-literal-hex, no-literal-px rule |
| `/suite-kit:linear-sync` | Reconciles `docs/roadmap.md` against Linear |

Per-repo configuration lives in [`.claude/suite.json`](../.claude/suite.json) —
product name, stack kind, Linear team, roadmap path, and the full health manifest.
The plugin's skills are generic and read that file; the invariants themselves stay
here, where they can be reviewed alongside the code they constrain.

`.claude/rules/*.md` are **not** replaced by the plugin. They are path-scoped and
auto-inject when a matching file is edited, which a plugin skill does not do.

---

## Setup

The marketplaces and plugins are declared in `.claude/settings.json`, so a clone
picks them up. Add this block if it is not present yet:

```json
"extraKnownMarketplaces": {
  "kollektiv": { "source": { "source": "github", "repo": "sandrogekeler/kollektiv" } },
  "omc": { "source": { "source": "github", "repo": "Yeachan-Heo/oh-my-claudecode" } }
},
"enabledPlugins": {
  "suite-kit@kollektiv": true,
  "oh-my-claudecode@omc": true
}
```

Declaring a plugin does not install it. Claude Code prompts on first run with a
`claude plugin install` line — run it once per machine.

[Oh-My-ClaudeCode](https://ohmyclaudecode.com/) rides along for multi-agent
orchestration. Two limits worth knowing before relying on it:

- `/team` spawns workers through **tmux** and optional external provider CLIs, so
  it only works on a local machine. Claude Code on the web gets the skills and
  agents but not team mode.
- It contributes a large number of agents and skills, all of which cost context on
  every turn. Check the **Context cost** figure in the `/plugin` detail view before
  leaving it enabled repo-wide.

---

## Tracking

Linear, workspace `KonnektMC`. One team per product — `KON` for Konnekt, `KMD` for
Kommands — so cycles and boards stay per-product, with suite-wide initiatives
spanning both.

Use Linear's magic words in PR descriptions (`Fixes KMD-12`, `Part of KMD-28`) to
drive the native GitHub integration. Every issue created from a roadmap line
carries a `Source: docs/roadmap.md § <section>` line, so the reconcile pass can
match issues back to sections without guessing from titles.
