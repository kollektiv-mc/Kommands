# Design tokens

The visual language is shared with Konnekt, the suite's desktop dashboard. Its
character: **dense, dark-first, hairline-bordered, shadowless.** Depth comes from
`0.5px` borders over translucent surfaces, never from drop shadows.

Both products read the same source. This file describes what that source contains
and how this repo turns it into CSS — it does not restate the values as prose, which
is how the two copies drifted apart in the first place.

---

## Pipeline

```
kollektiv/design/tokens.json  ──►  sync-tokens.sh  ──►  tokens.source.json
                                                        (vendored, committed)
                                                              │
                                                     pnpm gen:tokens
                                                              ▼
                                                     src/styles/tokens.css
                                                     (generated, committed)
```

> **Not built yet.** `pnpm gen:tokens` and `src/styles/tokens.css` do not exist —
> this repo is pre-scaffold. The contract below is what to implement when the app
> is scaffolded; Konnekt's `frontend/scripts/gen-tokens.mjs` is a working
> implementation of the same contract against the same source.

`src/styles/tokens.css` is **generated and committed**, with a DO-NOT-EDIT header.
`tokens.source.json` is committed too: a build must work from a standalone clone,
without a `kollektiv` checkout beside it.

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

`/health-check` greps for `#[0-9a-f]{3,8}` and `\[[0-9.]+px\]` in those directories
and fails on a hit.

Every value the design needs has a named token — including the awkward ones
(`9px`, `0.5px`, `10px` radius) that would otherwise be inlined. **If a value seems
to be missing, add a token; do not inline it.** That is the whole reason the scale
names non-standard steps.

---

## What the source defines

The authoritative list is `tokens.source.json`, and
`kollektiv/design/tokens.schema.json` is its contract. Read those rather than a
table here. In outline:

| Group | Contains | Reaches components as |
|---|---|---|
| `color.surface` | `bg-base`, `bg-elevated`, `bg-surface`, `hover-surface` | `bg-canvas`, `bg-elevated`, `bg-surface`, `bg-hover` |
| `color.border` | `border-subtle`, `border-hover` | `border-border-subtle`, `border-border-hover` |
| `color.text` | `text-primary`, `text-secondary`, `text-muted`, `text-faint` | `text-text-primary`, … |
| `color.status` | `accent`, `success`, `warning`, `danger`, `sun` | `text-accent`, `bg-success`, … |
| `type.size` | `3xs` 9px, `2xs` 10px, `1xs` 11px, `xs` 12px, `sm` 14px, `lg` 18px, `xl` 20px | `text-2xs`, … |
| `type.family` | `sans`, `title`, `mono`, `display` | `font-sans`, `font-title`, … |
| `radius` | `sm`, `md`, `lg`, `panel`, `xl`, `pill` | `rounded-panel`, … |
| `border` | `hairline` 0.5px, `thick` 1.5px | `border-hairline`, `border-thick` |
| `motion` | `duration.fast`, `duration.panel`, `easing.standard` | `var(--duration-fast)`, `ease-standard` |
| `space` | the 4px grid | Tailwind's built-in `p-*` / `gap-*` |

Colour names describe **role, never appearance** — `--bg-elevated`, not
`--grey-800`. An appearance-named token becomes a lie the moment a theme changes it.

Theme is switched by `[data-theme]` on the root element. Light mode darkens success,
warning and danger for contrast against a light canvas; accent is user-configurable.

This is a dense UI — **12px is the body size, not 16px**. Weights are `400` body,
`500` medium, `600` semibold, `900` display. Monospace is used heavily for generated
command text and any Minecraft identifier.

### Status colours are RGB channel triplets

The generator emits each status role twice, so alpha composes from a single token:

```css
--accent-rgb: 74 222 128;
--accent: rgb(var(--accent-rgb));

/* compose alpha without a second token */
box-shadow: 0 0 20px 4px rgb(var(--accent-rgb) / 0.2);
```

---

## There are no shadow tokens

Deliberately. The suite uses zero drop shadows. Elevation is communicated by
translucent surfaces plus hairline borders. The only permitted `box-shadow` is an
accent-tinted glow inside a keyframe animation, as above.

If a design seems to need a drop shadow, it needs a different surface or border.

---

## Component patterns shared with Konnekt

| Pattern | Shape |
|---|---|
| Panel / tile | `rounded-panel` + `border-hairline` over `bg-surface` |
| Segmented control | Pill container, sliding accent indicator at `--radius-lg` minus 1px |
| Toggle | `20×36px` pill, `16px` knob, accent when on, `--border-hover` when off |
| Row divider | `border-bottom: var(--border-hairline) solid var(--border-subtle)` |
| Scrollbar | `4px`, `--border-hover` thumb, transparent track |
| Value text | Monospace, `text-xs`, `text-text-secondary` |

The sliding-indicator radius is `--radius-lg` minus 1px so it sits concentrically
inside the container border. Concentric radii matter at hairline weights —
mismatched values rasterise unevenly and read as a rendering bug.

---

## Adding a token

1. Add it to `kollektiv/design/tokens.json`. Name it by role.
2. Run `./scripts/sync-tokens.sh` from the kollektiv root — this refreshes
   `tokens.source.json` here *and* in Konnekt.
3. Run `pnpm gen:tokens` and commit the regenerated `src/styles/tokens.css`
   alongside the updated `tokens.source.json`.
4. Regenerate in Konnekt too, so both products move together.

Never edit `src/styles/tokens.css` — it is overwritten. Never edit
`tokens.source.json` either: the next sync overwrites it, and the value never
reaches Konnekt.
