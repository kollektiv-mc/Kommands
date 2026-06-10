# Tiers — the subscription-tier engine

Two things share the word "tier" in this repo. Keep them straight.

| | Status |
|---|---|
| [`TIERS.md`](../TIERS.md) (root) | **Design spec** — absolute per-tier tables, kept as reference. |
| `shared/tiers.js` + `shared/auth.js` tier field | **Engine BUILT + wired.** |

The **engine** (data + logic + lock primitive + styles) is built and live. Wired:
**generator gating** (`give` + `summon` call `tierFeatures()` / `lockSection()` /
`lockControl()`), and **tier-limited presets and history** — `savePreset()` refuses at
`tierFeatures().savedPresets`, `addToHistory()` honors `tierFeatures().commandHistory`,
and both generators expose a cap-gated **save preset** control via
`initPresetSaver()`. The only piece **not** built is the **payment UI** (tier is set
from `profile.html` for now). That is a separate task.

---

## Single source of truth

- **Tier order:** one `TIER_ORDER` definition, in `shared/auth.js`
  (`['free','copper','iron','gold','diamond','netherite']`). `shared/tiers.js`
  consumes that global — it does **not** redefine it, and must load after `auth.js`.
- **Active tier:** the `tier` field on the user record (`mcgen_users`), via
  `getUserTier()`. There is **no `mcgen_tier` localStorage key** — the spec's standalone
  key was dropped. `getUserTier()` returns `null` when unset; `currentTier()` maps
  `null` / logged-out → `'free'`.

The earlier spec/reality conflicts are resolved this way: `free` is now a real member
of `TIER_ORDER` (base tier), and the user record — not a standalone key — is the one
source for the active tier.

---

## Delta + merge model

`TIER_FEATURES` is **not** restated at every tier. `free` holds the complete base
config; each higher tier stores only the keys it **adds or raises** over the tier
beneath it. `tierFeatures()` merges `free → … →` the active tier into one resolved
object.

Merge rule (`resolveTier`):

- plain objects merge **recursively** (e.g. `give`, `summon`);
- arrays and primitives **replace wholesale** (e.g. `title.modesAllowed` swaps, it does
  not index-merge);
- the deeper tier wins.

Invariant, by construction: a higher tier may only **add or raise**, never remove. (The
spec's `iron.savedPresets = 0` — lower than copper's 1 — was a leftover from the
absolute model; iron simply omits the key and inherits copper's `1`.)

```js
const tf  = tierFeatures();   // merged config for the active tier
tf.give.loreLines;            // e.g. 2 on iron, 10 on diamond, Infinity on netherite
tf.summon.equipment;          // false until gold
```

---

## API (`shared/tiers.js`)

| Function | Returns |
|---|---|
| `currentTier()` | active tier string; `'free'` when null / logged-out |
| `tierFeatures()` | merged feature config for the active tier |
| `resolveTier(tier)` | merged config for any named tier (pure) |
| `tierAtLeast(required)` | `true` if active tier ≥ `required` |
| `minTierFor(gen, feat)` | lowest tier whose **merged** config enables `gen.feat`; call with one arg (`minTierFor('savedPresets')`) for a **top-level** feature key |

`TIER_FEATURES` itself holds the **deltas**, not resolved configs — read through
`tierFeatures()` / `resolveTier()`, never index `TIER_FEATURES[tier]` directly.

---

## Locking primitive

`lockSection(el, minTier)` in [`shared/util.js`](../shared/util.js): disables every
control in `el` and appends a `requires {tier}` `.lock-tag` (in the tier color) to its
`.block-label`. Locked sections stay visible — **never hide what's gated**.
Styles: `.section-locked` and `.lock-tag` in `shared/style.css`; tier colors are
`var(--free | --copper | --iron | --gold | --diamond | --netherite)`.

---

## Storage keys (current)

| Key | Contents |
|---|---|
| `mcgen_users` | JSON array of user records (each holds `tier`, `presets`, `history`, `collections`) |
| `mcgen_session` | Active user id |

No `mcgen_tier`, `mcgen_presets`, or `mcgen_history` keys — all of that lives on the
user record. See [auth.md](auth.md) for the full account model.
