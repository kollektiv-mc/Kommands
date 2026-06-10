# PRESETS_PLAN — tier-capped saved presets, end-to-end

Self-contained build plan. Survives `/clear`: re-orient from this file, not chat
memory. Goal: extend the existing generator tier-gating model to **saved presets**.
Single source of truth = `tierFeatures()` (from `shared/tiers.js`). No hardcoded tier
strings; labels derive from `minTierFor()`. Vanilla static HTML/CSS/JS only.

## Approved decisions (locked)

1. **Generalize `minTierFor`** to a one-arg form for top-level keys (`savedPresets`).
   Two-arg `(gen, feat)` path untouched. Add a TODO that `minTierForTarget()` in
   give.html is now redundant — **do not** refactor it this session.
2. **Infinity history ceiling = 200** (must exceed diamond's 100 to keep the
   monotonic never-downgrade invariant). Finite tiers slice to their exact cap.
3. **Save-preset control is gated ONLY by the `savedPresets` cap** — never by the
   host generator's lock. It sits OUTSIDE summon's `<main>`. A sub-iron user may save
   the base summon command; that is intended.
4. **auth.js → `tierFeatures()`** runtime call accepted, guarded with
   `typeof tierFeatures === 'function'`, **fail-closed to cap 0**. No layering
   restructure.

## Files & interfaces touched

### `shared/auth.js`
- `savePreset(name, command, generator)` → new contract: returns `{ id }` on success,
  `{ error }` on failure. Refuses when `getPresets().length >= cap`, where
  `cap = (typeof tierFeatures === 'function') ? tierFeatures().savedPresets : 0`.
  Also `{ error }` when logged-out or empty name. Free (cap 0) → length 0 ≥ 0 → never
  saves. **No current callers** besides the new UI, so the contract change is safe.
- `addToHistory(command, generator)` → honor tier:
  `cap = tierFeatures().commandHistory` (guarded, fail-closed 0).
  `cap <= 0` → return false (don't record). Else `limit = cap === Infinity ? 200 : cap`,
  slice newest-first to `limit`. Raise `HISTORY_LIMIT` 50 → 200 (the Infinity ceiling).

### `shared/tiers.js`
- `minTierFor(generatorKey, featureKey)`: when `featureKey === undefined`, test the
  **top-level** `resolveTier(tier)[generatorKey]` instead of the nested key. Same
  truthiness rule (`=== true` or `number > 0`). Backward compatible.

### `shared/util.js`
- New shared widget `initPresetSaver(generatorKey)`. Finds fixed-id controls
  (`#preset-row`, `#preset-name`, `#preset-save-btn`, `#preset-status`), wires save +
  inline status, and runs `applyGate()`:
  - logged-out → disable input+button, status = "sign in to save" anchor (`../../auth.html`).
  - `cap <= 0` → `lockControl(#preset-row, minTierFor('savedPresets'))` ("requires copper").
  - at cap (`len >= cap`, finite) → disable, status = `${len}/${cap} · upgrade to save more`.
  - under cap → enabled, status = `${len}/${cap} saved` (or `${len} saved` when ∞).
  - Save: read `#output`.textContent, `savePreset(name, cmd, generatorKey)`; on
    `{error}` show it, on success clear name, status "saved ✓", re-gate after 1.4s.
  No `alert`/`confirm`. Uses `textContent`; the sign-in link is a built `<a>` node.

### `generators/give/give.html` and `generators/summon/summon.html`
- Add a small static block immediately **before** `.output-block`
  (summon: also **after `</main>`**):
  ```html
  <div class="block" id="preset-saver">
    <div class="block-label">save preset</div>
    <div class="field-row" id="preset-row">
      <input type="text" id="preset-name" placeholder="preset name…" maxlength="40">
      <button class="btn-add" id="preset-save-btn">save preset</button>
      <span class="hint" id="preset-status"></span>
    </div>
  </div>
  ```
- Call `initPresetSaver('give')` / `initPresetSaver('summon')` in end-of-body init.
- Reuses existing shared classes only (`.block`, `.block-label`, `.field-row`,
  `.btn-add`, `.hint`, `.section-locked`/`.lock-tag` via `lockControl`). No new CSS.

### `profile.html`
- Load `shared/util.js` (for `copyToClipboard`).
- `renderPresets()`: add a command span (`.item-cmd`) between name and tag; switch the
  copy button to `copyToClipboard(p.command, copyBtn)`. Row: name · cmd · tag · date ·
  copy · del. Reuse existing local `.item-*` classes — no new CSS tokens.

### `docs/tiers.md`
- Status table row: engine + generator gating (give, summon) + tier-limited
  presets/history now BUILT. Fix the "not built yet" paragraph: only the payment UI
  remains unbuilt. Note `minTierFor` resolves top-level keys (one-arg). Keep compact.

## Out of scope (do NOT touch)
Collections; history-tab UI; payment UI; give's existing target/enchant/display gating;
summon's existing gating; `minTierForTarget()` refactor (TODO only); `docs/auth.md`'s
stale "HISTORY_LIMIT = 50" line (note, don't edit).

## STEP 3 — end-to-end verification (real headless Edge, evidence required)
Per repo convention (no test suite). Set tier via `setUserTier()` in console; reload.
- **free** (cap 0): save control locked, "requires copper"; `savePreset` returns
  `{error}` and writes nothing; `addToHistory` records nothing.
- **copper** (savedPresets 1): 1 save succeeds; 2nd → "1/1 · upgrade to save more" and
  `{error}`; history records (cap 1).
- **high tier** (e.g. diamond/netherite): multiple saves; appear in `profile.html`
  presets tab with command text; copy + delete work.
- **Regression A/B**: byte-identical generator output vs git HEAD for an unchanged-tier
  scenario (the save UI must not alter command building).
- **Mid-session downgrade**: lower tier in console; confirm `addToHistory`/`savePreset`
  immediately honor the new cap (they re-read `tierFeatures()` per call).
Report per case: tier set, action, observed result, resulting stored state.

## STEP 4 — adversarial review
Fresh subagent diffs the change against this file: every requirement present, caps
derive from `tierFeatures()` (no hardcoded tier strings), nothing out-of-scope changed.
Report gaps as diffs.
