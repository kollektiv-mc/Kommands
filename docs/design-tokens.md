# Design tokens

The visual language is the suite's shared one, defined in
`kollektiv/design/tokens.json`. Its character: **dense, dark-first,
hairline-bordered, shadowless.** Depth comes from `0.5px` borders over translucent
surfaces, never from drop shadows.

---

## Where the values live

**This file does not list token values.** They live in one place —
`kollektiv/design/tokens.json` — vendored into this repo as `tokens.source.json`
and consumed by both Kommands and Konnekt. Read that file for the current set:
`color`, `type`, `space`, `radius`, `border`, `motion`.

A second copy here would drift the first time a token changed in one place and not
the other, which is exactly the duplication kollektiv exists to remove.

## Pipeline

```
kollektiv/design/tokens.json
   │  scripts/sync-tokens.sh  (run from the kollektiv root)
   ▼
tokens.source.json  ──►  pnpm gen:tokens  ──►  src/styles/tokens.css  ──►  @theme inline
   (vendored, committed)                        (generated, committed)      Tailwind utilities
```

`tokens.source.json` and `src/styles/tokens.css` are both committed — a build must
work from a standalone clone, without a `kollektiv` checkout beside it.
`src/styles/tokens.css` carries a DO-NOT-EDIT header. Tailwind v4's `@theme inline`
maps each custom property to a semantic utility, so `--color-canvas: var(--bg-base)`
yields `bg-canvas`.

Runtime theming works by overriding custom properties on `document.documentElement`,
so theme and accent changes need no rebuild and no re-render.

### What `gen:tokens` must do

1. Read `tokens.source.json` from the repo root.
2. Refuse a `version` it does not understand, rather than guessing at a shape.
3. Emit `src/styles/tokens.css` with a DO-NOT-EDIT header naming the source and the
   regeneration command.

Three details are easy to get wrong, and Konnekt got each of them wrong once:

- **Colours belong in `@theme inline`; scalars do not.** Under `inline`, Tailwind
  substitutes the literal into each utility and never emits the custom property —
  so `rounded-panel` compiles correctly while `var(--radius-panel)` resolves to
  nothing in hand-written CSS. Colours need `inline` so a utility resolves straight
  to the themed property that runtime theming overrides. Everything else belongs in
  a plain `@theme` block.
- **Border widths need `@utility`.** Tailwind v4 has no `--border-width-*`
  namespace, so `border-hairline` has to be declared:
  ```css
  @utility border-hairline {
    border-width: var(--border-hairline);
  }
  ```
- **Do not emit the space scale.** Tailwind's default `--spacing: 0.25rem` already
  yields `p-0.5` = 2px through `p-6` = 24px, identical to the shared scale.
  Re-declaring it adds a second thing to keep in step for no gain. Font weights are
  likewise covered by `font-normal` / `font-medium` / `font-semibold` / `font-black`.

---

## Rule: no literal hex or px in components

`src/components/**` and `src/routes/**` use `var(--token)` or a semantic Tailwind
utility. Never a raw `#hex`, and never an arbitrary pixel value like `text-[10px]`.

`/suite-kit:health` greps for `#[0-9a-f]{3,8}` and `\[[0-9.]+px\]` in those directories
and fails on a hit.

Every value the design needs has a named token — including the awkward ones
(`9px`, `0.5px`, `10px` radius) that would otherwise be inlined. **If a value seems
to be missing, add a token; do not inline it.** The scale names those non-standard
steps precisely because they are the ones that get inlined.

---

## Conventions the values encode

These are the things a bare list of tokens would not tell you.

**Names describe role, never appearance** — `--bg-elevated`, not `--grey-800`.
Theme is switched by `[data-theme]` on the root element.

**Status colours are RGB channel triplets.** Stored as space-separated channels so
alpha composes from a single token rather than needing a second one:

```css
--accent-rgb: 74 222 128;
--accent: rgb(var(--accent-rgb));

/* compose alpha without a second token */
box-shadow: 0 0 20px 4px rgb(var(--accent-rgb) / 0.2);
```

Light mode darkens success, warning, and danger for contrast against a light
canvas; accent is user-configurable.

**This is a dense UI** — the body size is 12px, not 16px. Space is on a 4px grid and
tight by default: `8px` gaps and `px-2`/`px-3` padding dominate, and anything above
`24px` is rare and usually wrong at this density.

**There are no shadow tokens, deliberately.** Elevation is communicated by
translucent surfaces plus hairline borders. The only permitted `box-shadow` is an
accent-tinted glow inside a keyframe animation, as above. If a design seems to need
a drop shadow, it needs a different surface or border instead.

---

## The three faces

`type.family` names Ranade (`--font-sans`), Excon (`--font-title`), and Satoshi
(`--font-display`). Those are real font files, not system faces, and the token
source cannot carry them — it holds values, not binaries. The `.woff2` files are
therefore vendored into `src/assets/fonts/` and declared as `@font-face` rules in
`src/styles/index.css`, alongside Konnekt's copies of the same three.

This is the one part of the token layer that is **not** generated, and the one that
fails silently: with the files absent every stack falls through to its next entry,
the app still renders, and the two products quietly stop looking alike. `--font-mono`
is the exception — it is system faces the whole way down and needs no file.

## Component patterns

| Pattern           | Shape                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Panel / tile      | `rounded-panel` + `border-hairline` over `bg-surface`                  |
| Segmented control | Pill container, sliding accent indicator at `--radius-lg` minus 1px    |
| Toggle            | `20×36px` pill, `16px` knob, accent when on, `--border-hover` when off |
| Row divider       | `border-bottom: var(--border-hairline) solid var(--border-subtle)`     |
| Scrollbar         | `4px`, `--border-hover` thumb, transparent track                       |
| Value text        | Monospace, `text-xs`, `text-text-secondary`                            |

The sliding-indicator radius is `--radius-lg` minus 1px so it sits concentrically
inside the container border. Concentric radii matter at hairline weights —
mismatched values rasterise unevenly and read as a rendering bug.

Monospace is used heavily for generated command text and any Minecraft identifier.

---

## The product skin

Two things about this app's look are **not** in the shared source and must not be:
its accent, and the canvas that accent sits on. Both live in
[`src/lib/theme.ts`](../src/lib/theme.ts), which is the one place in `src/` where a
colour is a value rather than a token reference.

The mechanism is a runtime override of shared token _names_ on
`document.documentElement`. kollektiv's own `design/README.md` names this pattern
and puts it exactly here — it is what Konnekt's `BUILTIN_SKINS` are, and it stays in
the product rather than in the umbrella repo, because it is a product-local look and
not a shared design decision.

| Written at runtime                           | Why it cannot be a token                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `--accent-rgb`                               | Both products read one source. An ember written there turns Konnekt orange too.                   |
| `--bg-base`, `--bg-elevated`, `--bg-overlay` | Same reason, one step out: the canvas is what makes the two products distinguishable at a glance. |

### The canvas is derived from the accent

Only saturation and lightness are stored. **Hue is read from the accent**, so
retinting one retints the other and the ground can never drift from the thing it is a
ground for. The dark skin resolves to `#1c1612` / `#2a221c`, which carries white text
at roughly 18:1 and the accent itself at roughly 7.9:1 — both asserted in
`theme.test.ts` rather than eyeballed, because the values are computed and a nudge to
the lightness is a one-character change that could quietly cross a line.

The lift off the shared `#05060a` is the point rather than a side effect: at 3%
lightness every hue is black, so a tint alone would have changed nothing anyone could
see.

`--bg-overlay` is **computed, never chosen** — `0.82 × elevated + 0.18 × base`, which
is the definition this document's own source gives it. Picking a fourth colour by eye
is how that relationship gets lost.

### Two traps this arrangement sets

- **An inline property outranks the stylesheet in _both_ themes.** That is what makes
  the accent override work, and it is a trap for the canvas, because unlike the
  accent, `bg-base` and friends _do_ have `[data-theme='light']` values in the
  generated sheet. Writing a skin once at startup and then flipping `data-theme`
  leaves light mode wearing the dark canvas with the sheet's own values unreachable.
  So `applyTheme()` never sets the attribute without rewriting the skin for it.
- **The Go shell restates `--bg-base` and cannot read it.** `main.go`'s
  `BackgroundColour` paints the window before the webview renders anything, so a
  stale value there is a coloured flash on every launch. `theme.test.ts` reads
  `main.go` and asserts the two agree.

---

## Adding a token

The source is `kollektiv/design/tokens.json`. This repo is a **consumer** and does
not define the set, so a value added here alone never reaches Konnekt.

1. Add it to `kollektiv/design/tokens.json`, named by role, not appearance.
2. Run `./scripts/sync-tokens.sh` from the kollektiv root — refreshes
   `tokens.source.json` in each cloned product.
3. Run `pnpm gen:tokens` here, and commit the regenerated `src/styles/tokens.css`
   alongside the updated `tokens.source.json`.
4. If components should reach it as a utility, map it in `@theme inline`.
5. Regenerate in Konnekt too, so both products move together.

Never edit `src/styles/tokens.css` directly — it is overwritten. Editing
`tokens.source.json` directly is the same mistake one step earlier: the next
`sync-tokens.sh` overwrites it, and Konnekt never sees the value.

See `/suite-kit:design-tokens` for the suite-wide rule this repo inherits.
