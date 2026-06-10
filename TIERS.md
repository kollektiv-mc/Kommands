# mcgen — Subscription Tiers

> ## STATUS: ENGINE BUILT (gating not yet wired)
>
> The tier **engine** is implemented in [`shared/tiers.js`](shared/tiers.js)
> (`TIER_FEATURES`, `tierFeatures()`, `resolveTier()`, `currentTier()`,
> `tierAtLeast()`, `minTierFor()`), with `lockSection()` in `shared/util.js` and
> `.section-locked`/`.lock-tag`/`--free` in `shared/style.css`. What is **not** built
> yet: per-generator gating (no page calls these), the payment UI, and tier-limited
> presets/history.
>
> **This document is the design reference, and the built code diverges from it in two
> deliberate ways — trust the code, not these snippets, for current behavior:**
> - **Deltas, not absolute tables.** The `TIER_FEATURES` table below restates every
>   feature at every tier. The code instead stores **deltas** (`free` is the base; each
>   tier lists only what it adds/raises) and merges them at runtime. The tables below
>   are kept as the human-readable reference for what each tier grants. (One fix: the
>   spec's `iron.savedPresets = 0` was a leftover — iron inherits copper's `1`.)
> - **One source for the active tier: the user record.** The `mcgen_tier` key,
>   `currentTier()`-from-localStorage, and the `mcgen_presets`/`mcgen_history` snippets
>   below are superseded. The active tier is the `tier` field on the user record
>   (`auth.js` `getUserTier()`); `TIER_ORDER` is defined once in `auth.js` (now
>   including `free`) and consumed by `tiers.js`.
>
> See [`docs/tiers.md`](docs/tiers.md) for the built engine.

Defines one free tier and five paid subscription tiers, their feature gates per generator, and how to implement gating in code.

---

## Tier definitions

| Tier | Price | CSS variable | Color |
|---|---|---|---|
| `free` | €0 | `--free` | `#444444` |
| `copper` | €15/mo | `--copper` | `#c87941` |
| `iron` | €45/mo | `--iron` | `#a8b0b8` |
| `gold` | €90/mo | `--gold` | `#d4a93c` |
| `diamond` | €200/mo | `--diamond` | `#4eccd4` |
| `netherite` | €450/mo | `--netherite` | `#9980b0` |

The free tier is the default for all users with no subscription. Paid tiers can be switched freely. No trial period.

Add `--free` to the CSS variables in `shared/style.css`:

```css
--free: #444444;
```

---

## Tier registry (`shared/tiers.js`)

Add a new shared file `shared/tiers.js`. Load it on every page **before** the page's own script:

```html
<script src="../shared/tiers.js"></script>   <!-- generators/ pages -->
<script src="./shared/tiers.js"></script>    <!-- root-level pages -->
```

No `defer` — generators read `tierFeatures()` synchronously on init.

```js
// shared/tiers.js

const TIER_ORDER = ['free', 'copper', 'iron', 'gold', 'diamond', 'netherite'];

function currentTier() {
  return localStorage.getItem('mcgen_tier') || 'free';
}

// Returns true if the active tier meets or exceeds `required`.
function tierAtLeast(required) {
  return TIER_ORDER.indexOf(currentTier()) >= TIER_ORDER.indexOf(required);
}

// Returns the feature config object for the active tier.
// Always returns a valid object — free tier is the default.
function tierFeatures() {
  return TIER_FEATURES[currentTier()];
}

// Returns the lowest tier name that has `feature` set to true / non-zero.
// Used to label lock overlays ("requires gold").
function minTierFor(generatorKey, featureKey) {
  for (const tier of TIER_ORDER) {
    const val = TIER_FEATURES[tier]?.[generatorKey]?.[featureKey];
    if (val === true || (typeof val === 'number' && val > 0)) return tier;
  }
  return null;
}

const TIER_FEATURES = {

  free: {
    give: {
      enabled: true,
      countMax: 1,          // count locked to 1
      customName: false,    // no custom name
      loreLines: 0,
      rarity: false,
      enchantMaxLevel: 0,   // no enchants
      attributeModifiers: 0,
      unbreakable: false,
      enchantGlintOverride: false,
      hideTooltip: false,
      damageComponents: false,
      foodComponent: false,
      canBreakPlaceOn: false,
      potionContents: false,
      dyedColor: false,
      fireworks: false,
      customModelData: false,
      customData: false,
      moddedIds: false,
    },
    summon:     { enabled: false },
    enchant:    { enabled: false },
    effect:     { enabled: false },
    particle:   { enabled: false },
    title:      { enabled: false },
    scoreboard: { enabled: false },
    tellraw:    { enabled: false },
    savedPresets:     0,
    commandHistory:   0,
    batchExport:      false,
    mcfunctionExport: false,
    datapackExport:   false,
    targetSelector:   false,
  },

  copper: {
    give: {
      enabled: true,
      countMax: 64,
      customName: true,     // required — must not be empty
      loreLines: 1,
      rarity: false,
      enchantMaxLevel: 0,   // 0 = enchants unavailable
      attributeModifiers: 0,
      unbreakable: false,
      enchantGlintOverride: false,
      hideTooltip: false,
      damageComponents: false,
      foodComponent: false,
      canBreakPlaceOn: false,
      potionContents: false,
      dyedColor: true,
      fireworks: false,
      customModelData: false,
      customData: false,
      moddedIds: false,
    },
    summon:     { enabled: false },
    enchant:    { enabled: false },
    effect:     { enabled: false },
    particle:   { enabled: false },
    title:      { enabled: false },
    scoreboard: { enabled: false },
    tellraw:    { enabled: false },
    savedPresets:     1,
    commandHistory:   1,
    batchExport:      false,
    mcfunctionExport: false,
    datapackExport:   false,
    targetSelector:   true,
  },

  iron: {
    give: {
      enabled: true,
      countMax: 64,
      customName: true,
      loreLines: 2,
      rarity: false,
      enchantMaxLevel: null,  // null = respect vanilla max
      attributeModifiers: 0,
      unbreakable: true,
      enchantGlintOverride: false,
      hideTooltip: false,
      damageComponents: false,
      foodComponent: false,
      canBreakPlaceOn: false,
      potionContents: false,
      dyedColor: true,
      fireworks: false,
      customModelData: false,
      customData: false,
      moddedIds: false,
    },
    summon: {
      enabled: true,
      customName: true,
      behaviorFlags: true,
      healthAttributes: false,
      equipment: false,
      activeEffects: false,
      tags: false,
      passengers: false,
      mobSpecific: false,
    },
    enchant:    { enabled: true,  beyondVanillaMax: false },
    effect:     { enabled: true,  presetsOnly: true },
    particle:   { enabled: false },
    title:      { enabled: true,  modesAllowed: ['actionbar'] },
    scoreboard: { enabled: false },
    tellraw:    { enabled: false },
    savedPresets:     0,
    commandHistory:   10,
    batchExport:      false,
    mcfunctionExport: false,
    datapackExport:   false,
    targetSelector:   true,
  },

  gold: {
    give: {
      enabled: true,
      countMax: 64,
      customName: true,
      loreLines: 4,
      rarity: true,
      enchantMaxLevel: null,
      attributeModifiers: 1,
      unbreakable: true,
      enchantGlintOverride: true,
      hideTooltip: false,
      damageComponents: false,
      foodComponent: false,
      canBreakPlaceOn: false,
      potionContents: false,
      dyedColor: true,
      fireworks: false,
      customModelData: false,
      customData: false,
      moddedIds: false,
    },
    summon: {
      enabled: true,
      customName: true,
      behaviorFlags: true,
      healthAttributes: true,
      equipment: true,
      activeEffects: false,
      tags: false,
      passengers: false,
      mobSpecific: false,
    },
    enchant:    { enabled: true,  beyondVanillaMax: false },
    effect:     { enabled: true,  presetsOnly: false },
    particle:   { enabled: false },
    title:      { enabled: true,  modesAllowed: ['title','subtitle','actionbar','times','clear','reset'] },
    scoreboard: { enabled: false },
    tellraw:    { enabled: false },
    savedPresets:     5,
    commandHistory:   20,
    batchExport:      false,
    mcfunctionExport: false,
    datapackExport:   false,
    targetSelector:   true,
  },

  diamond: {
    give: {
      enabled: true,
      countMax: 64,
      customName: true,
      loreLines: 10,
      rarity: true,
      enchantMaxLevel: null,
      attributeModifiers: 4,
      unbreakable: true,
      enchantGlintOverride: true,
      hideTooltip: true,
      damageComponents: true,
      foodComponent: true,
      canBreakPlaceOn: true,
      potionContents: true,
      dyedColor: true,
      fireworks: false,
      customModelData: false,
      customData: false,
      moddedIds: false,
    },
    summon: {
      enabled: true,
      customName: true,
      behaviorFlags: true,
      healthAttributes: true,
      equipment: true,
      activeEffects: true,
      tags: true,
      passengers: false,
      mobSpecific: false,
    },
    enchant:    { enabled: true,  beyondVanillaMax: false },
    effect:     { enabled: true,  presetsOnly: false },
    particle:   { enabled: true,  dustExtras: false, blockItemExtras: false },
    title:      { enabled: true,  modesAllowed: ['title','subtitle','actionbar','times','clear','reset'] },
    scoreboard: { enabled: true },
    tellraw:    { enabled: true,  clickHoverEvents: false, advancedTypes: false },
    savedPresets:     25,
    commandHistory:   100,
    batchExport:      true,
    mcfunctionExport: true,
    datapackExport:   false,
    targetSelector:   true,
  },

  netherite: {
    give: {
      enabled: true,
      countMax: 64,
      customName: true,
      loreLines: Infinity,
      rarity: true,
      enchantMaxLevel: Infinity,  // beyond-vanilla levels, e.g. Sharpness 10
      attributeModifiers: Infinity,
      unbreakable: true,
      enchantGlintOverride: true,
      hideTooltip: true,
      damageComponents: true,
      foodComponent: true,
      canBreakPlaceOn: true,
      potionContents: true,
      dyedColor: true,
      fireworks: true,
      customModelData: true,
      customData: true,
      moddedIds: true,
    },
    summon: {
      enabled: true,
      customName: true,
      behaviorFlags: true,
      healthAttributes: true,
      equipment: true,
      activeEffects: true,
      tags: true,
      passengers: true,
      mobSpecific: true,
    },
    enchant:    { enabled: true, beyondVanillaMax: true },
    effect:     { enabled: true, presetsOnly: false },
    particle:   { enabled: true, dustExtras: true, blockItemExtras: true },
    title:      { enabled: true, modesAllowed: ['title','subtitle','actionbar','times','clear','reset'], multiSegment: true },
    scoreboard: { enabled: true },
    tellraw:    { enabled: true, clickHoverEvents: true, advancedTypes: true },
    savedPresets:     Infinity,
    commandHistory:   Infinity,
    batchExport:      true,
    mcfunctionExport: true,
    datapackExport:   true,
    targetSelector:   true,
    apiAccess:        true,
  },
};
```

---

## Locking principle

**Never hide locked features. Always show them, always disabled, always labeled.**

A locked section or button must:
1. Remain fully visible in the layout
2. Have all its inputs/buttons disabled
3. Show a small inline label: `requires {tier}` in the tier's color

This means users can see what they're missing and what tier unlocks it.

---

## `lockSection(el, minTier)` — the one locking primitive

Add to `shared/util.js`. This is the only function needed for gating UI. Call it on any `.block` element that the current tier cannot access.

```js
// Disables all inputs in `el` and appends a "requires X" label to its .block-label.
// `el`      — a DOM element (the .block div)
// `minTier` — string, e.g. 'gold'
function lockSection(el, minTier) {
  el.classList.add('section-locked');
  el.querySelectorAll('input, select, button, textarea').forEach(i => {
    i.disabled = true;
  });

  // Append tier label to the block-label if present
  const label = el.querySelector('.block-label');
  if (label && !label.querySelector('.lock-tag')) {
    const tag = document.createElement('span');
    tag.className = 'lock-tag';
    tag.style.color = `var(--${minTier})`;
    tag.textContent = `requires ${minTier}`;
    label.appendChild(tag);
  }
}
```

CSS (add to `shared/style.css`):

```css
.section-locked {
  opacity: 0.35;
  pointer-events: none;
  user-select: none;
}

/* sits inline after the block-label text */
.lock-tag {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-left: 12px;
  opacity: 0.8;
}
```

---

## How generators use it

At the top of each generator's `<script>`, read the config once and lock any sections the tier doesn't cover:

```js
const tf = tierFeatures();
const gen = tf.give;  // swap 'give' for the generator key

// Lock entire sections based on boolean/numeric flags.
// The minimum tier strings below are illustrative — use minTierFor() if you want
// them derived automatically from TIER_FEATURES rather than hardcoded.
if (!gen.dyedColor)        lockSection(document.getElementById('section-dyed-color'),   'iron');
if (!gen.foodComponent)    lockSection(document.getElementById('section-food'),          'diamond');
if (!gen.fireworks)        lockSection(document.getElementById('section-fireworks'),     'netherite');
if (!gen.customData)       lockSection(document.getElementById('section-custom-data'),   'netherite');
if (gen.loreLines === 0)   lockSection(document.getElementById('section-lore'),          'iron');

// For the whole generator being unavailable (e.g. free/copper trying to open summon.html):
if (!tf.summon?.enabled) {
  lockSection(document.querySelector('main'), 'iron');
}
```

For numeric limits (lore lines, attribute modifiers), enforce in `buildCmd()` only — don't lock the UI, just silently cap:

```js
function buildCmd() {
  const tf = tierFeatures();
  const cap = tf.give.loreLines;
  const loreLines = collectedLore.slice(0, cap === Infinity ? undefined : cap);

  const attrCap = tf.give.attributeModifiers;
  const attrMods = collectedAttrs.slice(0, attrCap === Infinity ? undefined : attrCap);
  // ...
}
```

---

## `/give` — copper: forced custom_name

The custom name field stays visible and enabled on copper, but `buildCmd()` refuses to emit a command if it's empty:

```js
if (currentTier() === 'copper' && !customNameValue.trim()) {
  setOutput('');
  setStatus('copper tier requires a custom name');
  return;
}
```

---

## `/enchant` — netherite beyond-vanilla levels

```js
const beyondMax = tf.enchant.beyondVanillaMax;
const vanillaMax = selectedEnchant?.maxLevel ?? 1;
levelInput.max = beyondMax ? 32767 : vanillaMax;

if (beyondMax && levelValue > vanillaMax) {
  setStatus('level exceeds vanilla max — command block required', 'warn');
}
```

---

## `profile.html` — tier management page

Three tabs: **subscription**, **presets**, **history**.

### Subscription tab

All six tier cards always visible (free + five paid). Active tier has its left border lit in the tier color. Cards that are a higher tier than the current show a "switch" button; current tier shows "current" (disabled).

```js
function setTier(tier) {
  if (!TIER_ORDER.includes(tier)) return;
  localStorage.setItem('mcgen_tier', tier);
  location.reload();  // simplest re-init — no need for selective re-render
}
```

### Presets tab

Enforce the limit on save:

```js
function savePreset(name, generator, command) {
  const limit = tierFeatures().savedPresets;
  if (limit === 0) {
    // free tier has no presets; copper has 1 — message reflects the actual minimum
    setStatus('presets-status', 'requires copper or above');
    return;
  }
  const existing = loadPresets();
  if (limit !== Infinity && existing.length >= limit) {
    setStatus('presets-status', `limit reached (${limit})`);
    return;
  }
  existing.push({ id: crypto.randomUUID(), name, generator, command, saved: Date.now() });
  localStorage.setItem('mcgen_presets', JSON.stringify(existing));
}
```

### History tab

```js
function pushHistory(generator, command) {
  const limit = tierFeatures().commandHistory;
  if (limit === 0) return;
  const h = loadHistory();
  h.unshift({ generator, command, ts: Date.now() });
  localStorage.setItem('mcgen_history', JSON.stringify(
    limit === Infinity ? h : h.slice(0, limit)
  ));
}
```

---

## Storage keys

| Key | Contents |
|---|---|
| `mcgen_tier` | Active tier string (`free` \| `copper` \| `iron` \| `gold` \| `diamond` \| `netherite`) |
| `mcgen_presets` | JSON array of preset objects |
| `mcgen_history` | JSON array of history entries |

All storage is `localStorage`. Tier selection is local only — no auth, no server. Payment integration is out of scope.

---

## File changes summary

| File | Change |
|---|---|
| `shared/tiers.js` | **New.** `TIER_FEATURES`, `currentTier()`, `tierAtLeast()`, `tierFeatures()`, `minTierFor()` |
| `shared/util.js` | Add `lockSection()`, `pushHistory()`, `savePreset()`, `loadPresets()`, `loadHistory()` |
| `shared/style.css` | Add `.section-locked`, `.lock-tag` |
| `profile.html` | **New.** Subscription / presets / history tabs |
| `generators/*.html` | Each calls `lockSection()` on init for features the active tier doesn't cover |
| Every page `<head>` | Add `<script src="../shared/tiers.js"></script>` (no defer) |