'use strict';

// ── Subscription-tier engine ───────────────────────────────────────────────────
//
// The active tier is read from the user record via auth.js (`getUserTier()`); there
// is no standalone storage key. `TIER_ORDER` is defined once, in auth.js — this file
// consumes that global, so auth.js must be loaded before any tier function is called
// (it is loaded first on every page, and in the test harness).
//
// `TIER_FEATURES` is stored as DELTAS: `free` is the complete base config, and each
// higher tier lists only the keys it adds or raises over the tier beneath it.
// `tierFeatures()` merges free → … → the active tier into one resolved config.
// Invariant (by construction): a higher tier may only add or raise, never remove.

const TIER_FEATURES = {

  // Base config. Every key the engine exposes lives here; higher tiers override.
  free: {
    give: {
      enabled: true,
      countMax: 1,
      customName: false,
      loreLines: 0,
      rarity: false,
      // three-state, NOT a plain number — do not test with `> 0`:
      //   0 = no enchants · null = vanilla max · Infinity = beyond-vanilla
      enchantMaxLevel: 0,
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
    give: { countMax: 64, customName: true, loreLines: 1, dyedColor: true },
    savedPresets: 1,
    commandHistory: 1,
    targetSelector: true,
  },

  iron: {
    give:    { loreLines: 2, enchantMaxLevel: null, unbreakable: true },  // null = vanilla max
    summon:  { enabled: true, customName: true, behaviorFlags: true },
    enchant: { enabled: true },
    // presetsOnly inverts the usual convention: true = restricted (presets only),
    // false = full control — so a HIGHER tier (gold) sets it false.
    effect:  { enabled: true, presetsOnly: true },
    title:   { enabled: true, modesAllowed: ['actionbar'] },
    commandHistory: 10,
    // savedPresets intentionally omitted → inherits copper's 1 (tiers never downgrade).
  },

  gold: {
    give:   { loreLines: 4, rarity: true, attributeModifiers: 1, enchantGlintOverride: true },
    summon: { healthAttributes: true, equipment: true },
    effect: { presetsOnly: false },
    title:  { modesAllowed: ['title', 'subtitle', 'actionbar', 'times', 'clear', 'reset'] },
    savedPresets: 5,
    commandHistory: 20,
  },

  diamond: {
    give: {
      loreLines: 10,
      attributeModifiers: 4,
      hideTooltip: true,
      damageComponents: true,
      foodComponent: true,
      canBreakPlaceOn: true,
      potionContents: true,
    },
    summon:     { activeEffects: true, tags: true },
    particle:   { enabled: true },
    scoreboard: { enabled: true },
    tellraw:    { enabled: true },
    savedPresets: 25,
    commandHistory: 100,
    batchExport: true,
    mcfunctionExport: true,
  },

  netherite: {
    give: {
      loreLines: Infinity,
      enchantMaxLevel: Infinity,   // beyond-vanilla levels
      attributeModifiers: Infinity,
      fireworks: true,
      customModelData: true,
      customData: true,
      moddedIds: true,
    },
    summon:   { passengers: true, mobSpecific: true },
    enchant:  { beyondVanillaMax: true },
    particle: { dustExtras: true, blockItemExtras: true },
    title:    { multiSegment: true },
    tellraw:  { clickHoverEvents: true, advancedTypes: true },
    savedPresets: Infinity,
    commandHistory: Infinity,
    datapackExport: true,
    apiAccess: true,
  },
};

// Recursive merge: plain objects merge deep; arrays and primitives replace wholesale
// (so e.g. title.modesAllowed swaps rather than index-merging).
function _mergeTier(base, delta) {
  const out = { ...base };
  const mergeable = v => v && typeof v === 'object' && !Array.isArray(v);
  for (const key in delta) {
    const dv = delta[key];
    out[key] = (mergeable(dv) && mergeable(out[key])) ? _mergeTier(out[key], dv) : dv;
  }
  return out;
}

// Resolve a tier name to its full merged config (free → … → tier).
// An unknown tier resolves to free.
function resolveTier(tier) {
  const end = TIER_ORDER.indexOf(tier);
  let cfg = {};
  for (let i = 0; i <= (end === -1 ? 0 : end); i++) {
    cfg = _mergeTier(cfg, TIER_FEATURES[TIER_ORDER[i]]);
  }
  return cfg;
}

// The active tier, from the user record via auth.js. null / logged-out → 'free'.
function currentTier() {
  const t = (typeof getUserTier === 'function') ? getUserTier() : null;
  return (t && TIER_ORDER.includes(t)) ? t : 'free';
}

// Merged feature config for the active tier. Always a valid object.
function tierFeatures() {
  return resolveTier(currentTier());
}

// True if the active tier meets or exceeds `required`.
function tierAtLeast(required) {
  return TIER_ORDER.indexOf(currentTier()) >= TIER_ORDER.indexOf(required);
}

// Lowest tier whose MERGED config enables a feature (true, or a number > 0). Used to
// label lock overlays, e.g. "requires gold".
//   minTierFor('give', 'rarity')   → nested generator feature
//   minTierFor('savedPresets')     → top-level feature (featureKey omitted)
// TODO: minTierForTarget() in give.html is now redundant (it can call
// minTierFor('targetSelector')). Left as-is this session — do not refactor here.
function minTierFor(generatorKey, featureKey) {
  for (const tier of TIER_ORDER) {
    const cfg = resolveTier(tier);
    const val = (featureKey === undefined) ? cfg[generatorKey] : cfg[generatorKey]?.[featureKey];
    if (val === true || (typeof val === 'number' && val > 0)) return tier;
  }
  return null;
}
