# mcgen

Minecraft Java Edition command generator suite, targeting **1.21.1** exclusively.
Each generator is a self-contained `.html` file — no build step, no dependencies, no
framework. Open from disk or serve locally; everything is vanilla HTML/CSS/JS.

---

## Project structure

```
mcgen/
├── CLAUDE.md
├── TIERS.md                  # tier design spec/reference — engine is BUILT (see docs/tiers.md)
├── PRESETS_PLAN.md           # build plan for tier-capped presets — DONE (see docs/STATUS.md)
├── serve.py                  # local static server (port 3000)
├── _cdp_eval.ps1             # headless-Edge CDP driver (verification helper)
├── _preset_verify.html       # preset/history tier-cap test harness
├── index.html                # hub — generator grid
├── auth.html                 # sign in / sign up
├── profile.html              # account · tier · presets · history · subscription
├── shared/
│   ├── style.css            # design tokens + all shared components (source of truth)
│   ├── data.js              # MC 1.21.1 registries (ENCHANTS, ATTRIBUTES, EFFECTS, ENTITIES, …)
│   ├── util.js              # escaping, char-count, clipboard, tier-lock + preset-saver helpers
│   ├── auth.js              # localStorage accounts, sessions, tier, presets/history
│   └── tiers.js             # subscription-tier engine (TIER_FEATURES, tierFeatures, minTierFor)
├── generators/
│   ├── give/give.html       # /give — items with data components
│   └── summon/summon.html   # /summon — entities with legacy NBT
└── docs/
    ├── mc-1.21.1.md         # command / NBT / component reference for every generator
    ├── components.md        # HTML + CSS UI patterns
    ├── js-architecture.md   # the generator JS contract + shared layer
    ├── tiers.md             # tier engine (built) vs. TIERS.md spec
    ├── auth.md              # auth / profile subsystem
    └── STATUS.md            # project status audit (2026-06-10)
```

Generators live at `generators/<name>/<name>.html` (two levels deep). New generators
follow the same scheme.

---

## Commands

```
python serve.py
```

Serves the repo at `http://localhost:3000` and opens a browser (Ctrl+C to stop). Pages
also work directly from `file://`, but auth/`localStorage` behave best over
`http://localhost`.

---

## Hard rules

- **Vanilla only.** No frameworks, bundlers, libraries, or CDN deps beyond the single
  Google Fonts `@import` in `shared/style.css`.
- **`shared/style.css` is the single source of truth for styling.** Never hardcode
  token values or duplicate component CSS into a page or into docs — reference the
  classes and `var(--token)`s. Page-specific tweaks go in a small `<style>` block.
- **Use the shared layer.** Build on `shared/util.js` helpers, `shared/data.js`
  registries, and `shared/tiers.js`; do not reimplement them per page. Both built
  generators (`give.html`, `summon.html`) already do this — use either as a reference
  (details in `docs/js-architecture.md`).
- **1.21.1 Java Edition, data-component format** (post-1.20.5). Never emit old NBT
  item syntax like `{Enchantments:[...]}`. Verify every component/NBT key against
  [minecraft.wiki](https://minecraft.wiki); flag anything unconfirmed with
  `<!-- NOTE: verify -->`.
- **Plan first for non-trivial changes; ask before destructive ones.**

---

## Conventions

- `buildCmd()` is the live-build function on every generator — called on every input
  event and once at init. Output goes to `#output` via `textContent`.
- `textContent` over `innerHTML` for any user-controlled string.
- No `alert()` / `confirm()` — inline status text. Validation **warns**, never blocks.
- Char-count on every generator (256-char chat limit) via `updateCharCount()`.
- Smallest font size is 10px, used only for uppercase mono labels/metadata (e.g.
  `.block-label`, `.footer`); never smaller for body text in a generator.
- Section IDs are `kebab-case` matching their `.block-label` text.
- All files work from disk — relative paths only.
- When a future MC version is added, create `versions/` with a per-version registry;
  never mix version logic into generator files.

---

## Page template

Generator pages (two levels deep) use `../../shared/…` and `../../index.html`. Root
pages use `./shared/…`. Shared scripts load **without `defer`** so the end-of-body
init can use them synchronously.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>/{cmd} — mcgen 1.21.1</title>
  <link rel="stylesheet" href="../../shared/style.css">
  <script src="../../shared/data.js"></script>
  <script src="../../shared/util.js"></script>
  <script src="../../shared/auth.js"></script>
  <script>initAuthNav();</script>
</head>
<body>

  <div class="navbar">
    <a class="nav-brand" href="../../index.html">mcgen</a>
    <div class="nav-links">
      <a class="nav-link active" href="../../index.html">generators</a>
      <a class="nav-link" href="../../auth.html"    data-auth-show="out">sign in</a>
      <a class="nav-link" href="../../profile.html" data-auth-show="in">profile</a>
    </div>
  </div>

  <header>
    <h1>/{cmd} — Minecraft Java 1.21.1</h1>
    <p>data component format · post-1.20.5 syntax</p>
  </header>

  <div class="block">
    <div class="block-label">section name</div>
    <!-- fields -->
  </div>

  <div class="output-block">
    <div class="output-label">command output</div>
    <div class="output-cmd" id="output"></div>
    <div class="output-footer">
      <span class="char-count" id="char-count"></span>
      <button class="btn-copy" id="copy-btn" onclick="copyCmd()">copy</button>
    </div>
  </div>

  <div class="footer">
    <span>mcgen · mc 1.21.1</span>
    <span><a href="https://minecraft.wiki" target="_blank" rel="noopener">minecraft.wiki</a></span>
  </div>

  <script> /* sel(), buildCmd(), copyCmd(), bfcache pageshow handler */ </script>
</body>
</html>
```

---

## Reference docs

Read these on demand — they hold the detail that used to bloat this file:

- **`docs/mc-1.21.1.md`** — command syntax, components, and NBT for every generator,
  with built/planned status per `/give` component.
- **`docs/components.md`** — the HTML/CSS UI patterns (blocks, field rows, add/remove
  list rows, selects, output block, tabs).
- **`docs/js-architecture.md`** — the generator JS contract and the canonical
  `util.js` / `data.js` / `tiers.js` layer both generators build on.
- **`docs/tiers.md`** — how tiers actually work (cosmetic) vs. the `TIERS.md` spec.
- **`docs/auth.md`** — the `auth.js` / `auth.html` / `profile.html` account subsystem.
