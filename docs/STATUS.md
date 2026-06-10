# Project status audit

> **Audit date:** 2026-06-10 · ground-truth map of mcgen, code-first. Where docs and
> code disagree, the **code wins** and the disagreement is called out. Claims cite
> `file:line`. No code was changed in producing this report.

---

## 1. What this is / what was in progress

**mcgen** — a Minecraft Java **1.21.1** command-generator suite. Self-contained
vanilla HTML/CSS/JS, no build step (`CLAUDE.md`; `serve.py:1-13` is a 3000-port static
server). Two generators are shipped (`/give`, `/summon`); five more are stubbed "soon"
on the hub (`index.html:95-148`). On top of the generators sits a full **client-side
account + subscription-tier + presets/history** subsystem (`shared/auth.js`,
`shared/tiers.js`, `auth.html`, `profile.html`).

**Git trajectory is not readable from history.** Only two commits exist —
`733e6db initial commit` and `73ffc7b Add files via upload` — and the second is a bulk
upload, so the real work sequence must be reconstructed from the docs, not the log. The
working tree's only change is `D mcgen`: `mcgen` was a **git submodule gitlink**
(`git ls-tree HEAD mcgen` → mode `160000`, commit `b6a9e99`) that has been removed from
disk. It is unrelated to the app and is just a dirty-status artifact.

**Last thing worked on:** the build plan in `PRESETS_PLAN.md` — "tier-capped saved
presets, end-to-end." The code shows that plan **completed and verified**: every file
it names carries the described change (§5), and its Step-3 verification harness is
committed (`_preset_verify.html`, driven headless by `_cdp_eval.ps1`). The plan layered
on top of an already-built tier engine + generator gating (`docs/tiers.md`,
`docs/js-architecture.md`).

---

## 2. Feature inventory

| Area | Status | Evidence |
|---|---|---|
| **/give generator** | **FULLY WORKING** | `generators/give/give.html`. Live `buildCmd()` (389-462) emits data-component syntax; enchant dropdown derived from `ENCHANTS` (177-187); tier gating wired (`applyTierGates()` 362-387, `initPresetSaver('give')` 470). |
| **/summon generator** | **FULLY WORKING** | `generators/summon/summon.html`. `buildCmd()` (417-509) emits legacy entity NBT; `applyTierGates()` (393-414), whole-page lock below iron (396-399), `initPresetSaver('summon')` (518). |
| **Tier engine** (data + merge + resolve) | **FULLY WORKING** | `shared/tiers.js`: delta `TIER_FEATURES` (15-125), `_mergeTier`/`resolveTier` (129-148), `currentTier`/`tierFeatures`/`tierAtLeast`/`minTierFor` (151-179). Tokens `--free…--netherite` (`shared/style.css:18-23`), `.section-locked`/`.lock-tag` (527,534). |
| **Tier gating** (generators) | **FULLY WORKING — and WIRED** | give: `applyTierGates` + per-call gate in `buildCmd` (357-462). summon: `applyTierGates` + per-call gate (387-509). `buildCmd` re-reads `tierFeatures()` every call, so a mid-session downgrade strips premium output. **This contradicts `TIERS.md`'s header — see §3.** |
| **Auth** (signup/in/session) | **FULLY WORKING** (demo-grade) | `shared/auth.js:68-105`; `auth.html` forms + handlers (200-294). Passwords "hashed" with `btoa` — `auth.md:6-9` flags this as scaffolding, not security. |
| **Profile page** | **FULLY WORKING** | `profile.html`: identity (678-691), overview stats (694-721), presets tab (724-779), history tab (782-828), subscription carousel + `setUserTier`/`cancelTier` (831-1023). |
| **Presets** | **FULLY WORKING** | `savePreset` w/ `{id}`/`{error}` + cap (`auth.js:128-144`); shared saver widget (`util.js:106-161`); UI blocks (give 147-154, summon 167-174); profile render w/ command + copy + delete (`profile.html:724-779`). |
| **Command history** | **FULLY WORKING** | Tier-driven cap, `HISTORY_LIMIT=200` ceiling (`auth.js:9,183-201`); generators log on copy (give 464-467, summon 511-514); profile history tab (782-828). |
| **Payment / billing** | **NOT BUILT** (intentionally) | `docs/tiers.md:14-16`; tier is set free-of-charge from `profile.html` (998-1002). |
| `/enchant /effect /particle /title /scoreboard /tellraw` | **NOT BUILT** | Marked "soon" (`index.html:95-148`); specs only (`docs/mc-1.21.1.md:123-202`). Tier flags exist for them but have no consuming UI. |
| **Collections** | **PARTIAL (backend only)** | `auth.js:158-179` (create/delete/get) + counted in overview stats (`profile.html:699,704`); **no management UI** — out of scope per `PRESETS_PLAN.md:80`. |
| **Searchable dropdowns** | **NOT BUILT** | `docs/components.md:96-100` — native `<select>`+`<optgroup>` only for now. |

---

## 3. Doc ↔ code inconsistencies

**The headline question — is tier gating wired into the generators? → YES, it is wired.**
The code is unambiguous:

- `give.html` calls `applyTierGates()` (469) which paints locks via `lockSection`/
  `lockControl` (362-387), and `buildCmd()` gates every component on
  `tierFeatures().give` (389-461).
- `summon.html` does the same: `applyTierGates()` (517) + `buildCmd()` gating (417-509).

Therefore:

- **`TIERS.md` is STALE / WRONG.** Its header (`TIERS.md:3`) says *"STATUS: ENGINE BUILT
  (gating not yet wired)"* and lists *"per-generator gating (no page calls these)"* as
  not built (`TIERS.md:9-10`). The code refutes both — both pages call them. Treat the
  rest of `TIERS.md` as a **design reference only** (it even says so at lines 12-13); the
  absolute per-tier tables there are superseded by the delta model in `shared/tiers.js`.
- **`docs/tiers.md` and `docs/js-architecture.md` are CORRECT.** `docs/tiers.md:8-16`
  ("Engine BUILT + wired … only payment UI not built") and
  `docs/js-architecture.md:57-101` (describes `applyTierGates`, `minTierForTarget`,
  `minTierForEnchant`, the summon whole-page lock) both match the code.

Other inconsistencies:

- **`docs/auth.md:34-36`** still says history is *"capped at `HISTORY_LIMIT = 50`,
  newest first."* Code: `HISTORY_LIMIT = 200` (`auth.js:9`) and the **real** cap is
  tier-driven (`tierFeatures().commandHistory`, `auth.js:189-191`), not a flat 50. This
  is a **known** stale line — `PRESETS_PLAN.md:83` deliberately left it untouched.
- **`CLAUDE.md` structure block is stale.** It omits `shared/tiers.js`,
  `generators/summon/`, `profile.html`'s presets/history, `TIERS.md`/`PRESETS_PLAN.md`
  at root, and the `_cdp_eval.ps1`/`_preset_verify.html` helpers. (`docs/js-architecture.md`
  and `docs/components.md` are the up-to-date references.)
- **`CLAUDE.md` "give.html inlines local copies — don't copy those" is now FALSE.**
  Current `give.html` builds entirely on the shared layer — `ENCHANTS`/`ATTRIBUTES`/
  `SLOTS`/`OPERATIONS` from `data.js`, `escapeJson`/`updateCharCount`/`copyToClipboard`
  from `util.js`, `addToHistory` from `auth.js`; it defines no local copies of those
  helpers/registries. `docs/js-architecture.md:184-200` already states both generators
  build on the shared layer. The CLAUDE.md warning is outdated.
- **`profile.html` marketing vs. the give UI.** The `TIERS` array (`profile.html:587-654`)
  is a hand-maintained feature matrix that advertises components the `/give` UI does not
  build (see §4). It is a duplicate of the tier data, not derived from `TIER_FEATURES` —
  a drift source.

---

## 4. Bugs, dead code, TODOs, and unverified syntax

- **`NOTE: verify` markers:** none in code. The only hits are the *instructions* to use
  them (`CLAUDE.md:65`, `docs/mc-1.21.1.md:8`). 1.21.1 syntax is documented as actively
  verified — attribute-id prefix `generic.*` (`mc-1.21.1.md:15-18,108-116`) and the
  version-pinned summon NBT (`mc-1.21.1.md:75-119`). No legacy `{Enchantments:[...]}`
  syntax anywhere (grep clean).
- **`minTierForTarget()` redundancy (documented TODO).** `shared/tiers.js:170-171` notes
  `minTierForTarget()` in `give.html:200-202` is now redundant (it can call
  `minTierFor('targetSelector')` since `minTierFor` gained a one-arg top-level form).
  Left in place on purpose (`PRESETS_PLAN.md:11,82`). `minTierForEnchant()`
  (`give.html:203-205`) is **not** redundant — `enchantMaxLevel` is three-state
  (`0`/`null`/`Infinity`), which `minTierFor`'s `>0` rule can't resolve.
- **Possible minor bug — summon equipment enchant levels aren't tier-capped.**
  `summon.html` `buildLevelSelect` **always** appends a level-255 option (253-256) with
  no tier check, and `buildCmd` emits it unclamped (489). give.html only offers 255 when
  `enchantMaxLevel === Infinity` (netherite) and otherwise clamps to vanilla max
  (`give.html:244,426`). Net effect: a **gold** user (equipment unlocks at gold) can put
  beyond-vanilla enchant levels on mob equipment, which give reserves for netherite.
  Low severity (both are still valid commands), but an inconsistency in the gating model.
- **Feature gap — `/give` UI is a subset of what the tier table/markets gate.**
  `TIER_FEATURES` carries flags for `dyedColor`, `foodComponent`, `potionContents`,
  `canBreakPlaceOn`, `fireworks`, `customModelData`, `moddedIds`
  (`tiers.js:36-40,76-124`) and `profile.html` sells them (e.g. copper "Dye color"
  613/597, diamond "Food component"/"Potion contents" 634), but `give.html` has **no
  inputs** for any of them (grep: 0 matches for dyed/food/potion/can_break/fireworks/
  model_data). `docs/mc-1.21.1.md:46-53` correctly lists these as **planned**, so the
  reference doc is consistent — but the marketing card promises live features the app
  can't yet produce. These gating flags are effectively **dead config** until the UI
  lands.
- **Dead/inert engine surface.** Tier deltas for unbuilt generators
  (`enchant`/`effect`/`particle`/`title`/`scoreboard`/`tellraw`) and the export flags
  (`batchExport`/`mcfunctionExport`/`datapackExport`/`apiAccess`) have no consumers yet
  (`tiers.js`) — expected for staged work, but worth knowing they're untested in situ.
- **Security (by design, documented).** `auth.js:26-28` "hashes" passwords with `btoa`
  (reversible). `auth.md:6-9` explicitly calls this demo scaffolding. Not a regression —
  noting for completeness.

---

## 5. PRESETS_PLAN status — **fully implemented & verified**

Every file the plan touches carries its change; out-of-scope items were correctly left
alone.

| Plan item (`PRESETS_PLAN.md`) | State | Evidence |
|---|---|---|
| `auth.js` `savePreset` → `{id}`/`{error}`, cap-gated | DONE | `auth.js:128-144` (cap via `_presetCap()` 124-126, fail-closed) |
| `auth.js` `addToHistory` tier-honoring, `HISTORY_LIMIT 50→200` | DONE | `auth.js:9,183-201` (cap 0 → no record; Infinity → 200) |
| `tiers.js` `minTierFor` one-arg top-level form | DONE | `tiers.js:172-179` (`featureKey === undefined` branch) |
| `util.js` `initPresetSaver(generatorKey)` shared widget | DONE | `util.js:106-161` (logged-out / cap-0 lock / at-cap / under-cap) |
| give + summon: `#preset-saver` block + init call | DONE | give `147-154`,`470`; summon `167-174`,`518` (summon's block sits **after** `</main>`, gated by cap only — `163-174`) |
| `profile.html` presets: command span + `copyToClipboard`, load `util.js` | DONE | `profile.html:8-9,745-760` (`.item-cmd`, copy via `copyToClipboard`) |
| `docs/tiers.md` status updated to BUILT | DONE | `docs/tiers.md:8-16` |
| Out-of-scope left untouched: `minTierForTarget` refactor; `auth.md` "HISTORY_LIMIT=50" | RESPECTED | TODO still in `tiers.js:170`; stale line still `auth.md:34` |
| Step-3 verification harness (real headless Edge) | PRESENT | `_preset_verify.html` (logic L1-L6 + UI U1-U7), `_cdp_eval.ps1` (CDP driver) — both committed |

Nothing in `PRESETS_PLAN.md` appears unbuilt. It is a closed task.

---

## 6. What's needed to continue

**Open / pending decisions**

- **Payment UI** is the only tier piece docs call unbuilt (`docs/tiers.md:14-16`). Tiers
  are currently switchable for free in `profile.html`. Needs a product decision (real
  billing vs. keep as demo) before any work.
- **The `mcgen` submodule** is removed in the working tree but still tracked
  (`D mcgen`). Decide whether to `git rm mcgen` (clean status) or restore it. It is
  unrelated to the app.
- **Marketing vs. reality:** decide whether `profile.html`'s tier card should be derived
  from `TIER_FEATURES` (single source of truth) instead of the hand-kept `TIERS` array,
  to stop the drift in §3/§4.

**Recommended single next step:** *close the `/give` component gap* — add UI + `buildCmd`
emission for the components already gated and already advertised but not built
(`dyed_color`, `food`, `potion_contents`, `can_break`/`can_place_on`, `fireworks`,
`custom_model_data`, modded IDs).

*Reasoning:* it is the one place where **paid tiers currently promise features the app
cannot produce** (`profile.html:587-654` sells them; `give.html` has no inputs). The
hard parts are already done — the gating flags exist (`tiers.js`), the syntax is
specced and verified (`mc-1.21.1.md:46-53`), and the lock/preset plumbing is in place —
so this is a well-scoped, low-risk change that makes existing tiers deliver what they
charge for, rather than opening a new surface. If breadth is preferred over closing the
gap, `/effect` is the cleanest *new* generator to start (its `EFFECTS` registry and tier
flags already exist; spec at `mc-1.21.1.md:134-143`).
