# Generator JS architecture

The contract every generator follows, and the canonical shared layer it builds on.

---

## Canonical shared layer

Three files in `shared/` are the single source of truth. **Use them — do not
reimplement them per page.**

### `shared/util.js` — helpers

| Function | Purpose |
|---|---|
| `escapeJson(str)` | Escape `\` and `"` for JSON string values |
| `buildJsonText(text, opts)` | `{color,bold,italic,underlined,strikethrough,obfuscated}` → text-component object (defaults `italic:false`) |
| `charCount(cmd)` | → `{count, status:'ok'\|'warn'\|'danger', label}` (256-char chat limit) |
| `updateCharCount(cmd, el)` | Sets `el`'s class + label from `charCount()` |
| `copyToClipboard(text, btn)` | Writes clipboard, adds `.ok`, reverts after 1800ms |
| `slugify(str)` | `"generic.attack_damage"` → `"generic_attack_damage"` |
| `lockSection(el, minTier)` | Gate a **whole `.block`**: dim it, disable every control inside, tag its `.block-label` `requires <minTier>` |
| `lockControl(el, minTier)` | Gate **one control** in a composite block (a `.field-row` or `.toggle-item`): dim + disable only `el`, append the `requires <minTier>` tag to `el` itself — siblings stay live |

`lockSection` is for stand-alone sections (e.g. give's *attribute modifiers*) and for
the summon whole-page lock (`lockSection(<main>, …)`). `lockControl` is for composite
blocks where controls gate at **different** tiers (e.g. give's *display*: name=copper,
rarity=gold, the flag toggles each at their own tier). Both reuse the same
`.section-locked` / `.lock-tag` styles; neither hides — locked = visible + disabled +
labelled. See [tiers.md](tiers.md).

There is **no** `ticksToSeconds`/`secondsToTicks` yet — add them to `util.js` (not a
page) when the `/title` or `/effect` generator needs them.

### `shared/data.js` — registries (MC 1.21.1)

| Export | Shape |
|---|---|
| `ENCHANTS` | `{ id, name, maxLevel, category, order, applicableTo[] }` |
| `EFFECTS` | `{ id, name, color }` |
| `ATTRIBUTES` | `{ id, displayName }` |
| `SLOTS` | `string[]` (equipment slots) |
| `OPERATIONS` | `{ id, label }` (attribute-modifier ops) |
| `ENTITIES` | `{ id, name, category }` |
| `PARTICLES` | `{ id, extraData:bool }` |
| `VILLAGER_PROFESSIONS`, `VILLAGER_BIOMES`, `BIOMES` | `string[]` |

No `ITEMS`, `BLOCKS`, `CRITERIA`, or `COLORS` registry exists yet — add to `data.js`
(cross-checked against the wiki) when the generator that needs it is built.

### `shared/auth.js` — accounts, session, tier, presets/history

See [auth.md](auth.md). Relevant to generators: `initAuthNav()` and
`addToHistory(command, generator)`. Owns the single `TIER_ORDER` definition
(`['free','copper','iron','gold','diamond','netherite']`).

### `shared/tiers.js` — subscription-tier engine

The tier gating logic, **wired into `give.html` and `summon.html`**. See
[tiers.md](tiers.md) and [TIERS.md](../TIERS.md).

| Export | Purpose |
|---|---|
| `TIER_FEATURES` | Per-tier **deltas** (`free` is the full base; each higher tier lists only what it adds/raises) |
| `tierFeatures()` | The active tier's fully **merged** feature config |
| `resolveTier(tier)` | Merge `free → … → tier` (pure; used by `tierFeatures`/`minTierFor` and tests) |
| `currentTier()` | Active tier from `getUserTier()`; `null`/logged-out → `'free'` |
| `tierAtLeast(req)` | Active tier ≥ `req` in `TIER_ORDER` |
| `minTierFor(gen, feat)` | Lowest tier whose merged config enables `gen.feat` |

`tiers.js` consumes `auth.js`'s `TIER_ORDER` (does not redefine it) and reads the
active tier from the user record — there is **no `mcgen_tier` key**. It must load
**after** `auth.js`. The lock primitives `lockSection`/`lockControl` live in `util.js`.

#### How a generator gates by tier

Each gated generator (`give`, `summon`) adds an **`applyTierGates()`** that runs once
at init (after `initRegistries()`/before `buildCmd()`) and paints the locks via
`lockSection`/`lockControl`. **`buildCmd()` is the authoritative gate** — it re-reads
`tierFeatures()` on every call and only emits what the active tier permits, so a
mid-session tier *downgrade* strips premium output even though the visual locks were
only painted once at load. Numeric caps clamp in `buildCmd()` too (`countMax`, and the
`loreLines`/`attributeModifiers` counts via `.slice`).

Tiers and `requires X` labels are **always derived**, never hardcoded — gate conditions
read the resolved feature value from `tierFeatures()`, and labels come from
`minTierFor(gen, feat)`. Two give features `minTierFor()` can't resolve get small
`TIER_ORDER`/`resolveTier` walks instead (still no literal tier strings):

- **`targetSelector`** — a *top-level* feature key (not under `give`), so
  `minTierForTarget()` walks for the first tier where `resolveTier(t).targetSelector`.
- **`enchantMaxLevel`** — *three-state* (`0` = lock the enchant section · `null` =
  vanilla max · `Infinity` = beyond-vanilla), never a `>0` number, so
  `minTierForEnchant()` walks for the first tier where it `!== 0`, and `buildCmd`
  clamps each level to the vanilla max unless the value is `Infinity`.

The summon whole-page lock wraps the gated input blocks in `<main>` and calls
`lockSection(<main>, …)` below the door tier; **entity & position sit outside `<main>`**
so the sub-iron teaser stays interactive, and the output block keeps its ids/selectors.

---

## Load order (head)

Shared scripts load **without `defer`** so the end-of-body init script can use them
synchronously (matches the existing `auth.js` convention):

```html
<link rel="stylesheet" href="../../shared/style.css">
<script src="../../shared/data.js"></script>
<script src="../../shared/util.js"></script>
<script src="../../shared/auth.js"></script>
<script>initAuthNav();</script>
```

Root-level pages use `./shared/…` instead of `../../shared/…`. A page that gates by
tier additionally loads `tiers.js` **after** `auth.js` (it depends on that global) and
**before** the end-of-body page script — `give.html` and `summon.html` both do:

```html
<script src="../../shared/data.js"></script>
<script src="../../shared/util.js"></script>
<script src="../../shared/auth.js"></script>
<script src="../../shared/tiers.js"></script>
<script>initAuthNav();</script>
```

---

## The generator contract

1. **`sel(id)`** — `document.getElementById` shorthand used throughout.
2. **`buildCmd()`** — the one live-build function. Reads the DOM, assembles the
   command into an array of parts, writes it to `#output` via `textContent`, and
   refreshes the char-count. Called on **every** input/change event and **once at
   init** (`buildCmd();` at the end of the script).
3. **Input binding** — `oninput="buildCmd()"` / `onchange="buildCmd()"` on static
   controls; `addEventListener('input'|'change', buildCmd)` on dynamically created
   rows.
4. **Escaping** — use `escapeJson()` for any user text placed inside JSON.
5. **Char-count** — `updateCharCount(cmd, sel('char-count'))`.
6. **Copy** — `copyCmd()` reads `#output`, calls `copyToClipboard(text, btn)`, then
   logs it with `addToHistory(text, '<generator>')`.
7. **Validation** — inline status text only. **No `alert()`/`confirm()`.** Out-of-
   range values **warn**, they don't block (e.g. enchant level over vanilla max).
8. **bfcache** — re-assert nav state on restore:
   ```js
   window.addEventListener('pageshow', e => {
     if (e.persisted) {
       document.documentElement.classList.remove('authed', 'unauthed');
       initAuthNav();
     }
   });
   ```

Skeleton:

```js
'use strict';
function sel(id) { return document.getElementById(id); }

function buildCmd() {
  const parts = [];
  const name = sel('custom-name').value.trim();
  if (name) parts.push(`custom_name='[{"text":"${escapeJson(name)}","italic":false}]'`);
  // …read the rest of the DOM…
  const cmd = `/give ${target} ${item}${parts.length ? `[${parts.join(',')}]` : ''} ${count}`;
  sel('output').textContent = cmd;
  updateCharCount(cmd, sel('char-count'));
}

function copyCmd() {
  const txt = sel('output').textContent;
  copyToClipboard(txt, sel('copy-btn')).then(() => addToHistory(txt, 'give'));
}

buildCmd();
```

---

## Reference generators

Two generators are built, and **both build entirely on the shared layer** — use
either as a working reference for structure, patterns, and the canonical helpers:

| Generator | Builds on |
|---|---|
| `generators/give/give.html` | `data.js` + `util.js` + `auth.js`; `escapeJson`, `updateCharCount`, `copyToClipboard`; `ENCHANTS` (grouped, see below), `ATTRIBUTES`, `SLOTS`, `OPERATIONS` |
| `generators/summon/summon.html` | same shared layer; `ENTITIES`, `ATTRIBUTES`, `EFFECTS`, and the shared `ENCHANTS` grouping |

New generators **must** load the shared files (`data.js`, `util.js`, `auth.js`) and
use these helpers/registries rather than reimplementing them per page.

**Enchant grouping is shared.** The grouped enchant dropdown (optgroups by item
category, in a curated order) is **derived from `data.js`** — each `ENCHANTS` entry
carries a `category` (group label) and `order` (global display position). A generator
builds its groups by sorting `ENCHANTS` by `order` and bucketing by `category`; the
per-enchant max comes from `ENCHANTS[].maxLevel`. No generator keeps a local enchant
list. (`category`/`order` are a separate axis from `applicableTo`.)
