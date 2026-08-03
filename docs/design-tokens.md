# Design tokens

The visual language is derived from the Konnekt project. Its character: **dense,
dark-first, hairline-bordered, shadowless.** Depth comes from `0.5px` borders over
translucent surfaces, never from drop shadows.

---

## Pipeline

```
token source  ──►  pnpm gen:tokens  ──►  src/styles/tokens.css  ──►  @theme inline
                                          (generated, committed)      Tailwind utilities
```

`src/styles/tokens.css` is **generated and committed**, with a DO-NOT-EDIT header.
Tailwind v4's `@theme inline` maps each custom property to a semantic utility, so
`--color-canvas: var(--bg-base)` yields `bg-canvas`.

Runtime theming works by overriding custom properties on `document.documentElement`,
so theme, accent, and skin changes need no rebuild and no re-render.

---

## Rule: no literal hex or px in components

`src/components/**` and `src/routes/**` use `var(--token)` or a semantic Tailwind
utility. Never a raw `#hex`, and never an arbitrary pixel value like `text-[10px]`.

`/health-check` greps for `#[0-9a-f]{3,8}` and `\[[0-9.]+px\]` in those directories
and fails on a hit.

Every value the design needs has a named token — including the awkward ones
(`9px`, `0.5px`, `10px` radius) that would otherwise be inlined. **If a value seems
to be missing, add a token; do not inline it.** That is the whole reason the scale
below names non-standard steps.

---

## Colour

Semantic, not literal. Names describe role, never appearance — `--bg-elevated`, not
`--grey-800`.

Theme is switched by `[data-theme]` on the root element.

| Token | Dark | Light |
|---|---|---|
| `--bg-base` | `#05060a` | `#f5f6fa` |
| `--bg-elevated` | `rgba(18,20,30,0.82)` | `rgba(236,238,245,0.82)` |
| `--bg-surface` | `rgba(255,255,255,0.025)` | `rgba(0,0,0,0.03)` |
| `--hover-surface` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.05)` |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.09)` |
| `--border-hover` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.18)` |
| `--text-primary` | `#ffffff` | `#0b0d12` |
| `--text-secondary` | `rgba(255,255,255,0.6)` | `rgba(0,0,0,0.65)` |
| `--text-muted` | `rgba(255,255,255,0.4)` | `rgba(0,0,0,0.45)` |
| `--text-faint` | `rgba(255,255,255,0.25)` | `rgba(0,0,0,0.3)` |

### Status colours are RGB channel triplets

Stored as space-separated channels so alpha composes from a single token:

```css
--accent-rgb: 74 222 128;
--accent: rgb(var(--accent-rgb));

/* compose alpha without a second token */
box-shadow: 0 0 20px 4px rgb(var(--accent-rgb) / 0.2);
```

| Role | Dark default | Light override |
|---|---|---|
| `--accent-rgb` | `74 222 128` (`#4ade80`) | *(same)* |
| `--success-rgb` | `34 197 94` (`#22c55e`) | `22 163 74` |
| `--warning-rgb` | `245 158 11` (`#f59e0b`) | `217 119 6` |
| `--danger-rgb` | `248 113 113` (`#f87171`) | `239 68 68` |
| `--sun-rgb` | `255 216 77` (`#ffd84d`) | *(same)* |

Light mode darkens success, warning, and danger for contrast against a light
canvas. Accent is user-configurable.

---

## Type

| Token | Value |
|---|---|
| `--font-sans` | `Ranade`, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif |
| `--font-title` | `Excon`, var(--font-sans) |
| `--font-mono` | ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, monospace |
| `--font-display` | `Satoshi` (weight 900 only) |

This is a dense UI — 12px is the body size, not 16px.

| Token | Value | Use |
|---|---|---|
| `--text-3xs` | `9px` | Uppercase metadata labels only |
| `--text-2xs` | `10px` | Compact labels, badges |
| `--text-xs-` | `11px` | Secondary values |
| `--text-xs` | `12px` | **Body default** |
| `--text-sm` | `14px` | Section headings |
| `--text-lg` | `18px` | Page headings |
| `--text-xl` | `20px` | Display |

Weights: `400` body, `500` medium, `600` semibold, `900` display. Monospace is used
heavily for generated command text and any Minecraft identifier.

---

## Space

4px grid. Tight by default.

| Token | Value |
|---|---|
| `--space-0-5` | `2px` |
| `--space-1` | `4px` |
| `--space-1-5` | `6px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |

`8px` gaps and `px-2` / `px-3` padding dominate; anything above `24px` is rare and
usually wrong at this density.

---

## Border, radius, shadow

| Token | Value | Use |
|---|---|---|
| `--border-hairline` | `0.5px` | **The signature.** Panels, rows, dividers |
| `--border-thick` | `1.5px` | Emphasis, resize handles |
| `--radius-sm` | `3px` | Inline code, small chips |
| `--radius-md` | `6px` | Inputs, buttons |
| `--radius-lg` | `8px` | Grouped controls |
| `--radius-panel` | `10px` | **Panels and tiles** |
| `--radius-xl` | `12px` | Modals |
| `--radius-pill` | `9999px` | Toggles, pills, segmented controls |

**There are no shadow tokens, deliberately.** Konnekt uses zero drop shadows across
its entire component set. Elevation is communicated by translucent surfaces plus
hairline borders. The only permitted `box-shadow` is an accent-tinted glow inside a
keyframe animation:

```css
box-shadow: 0 0 20px 4px rgb(var(--accent-rgb) / 0.2);
```

If a design seems to need a drop shadow, it needs a different surface or border
instead.

---

## Motion

| Token | Value |
|---|---|
| `--duration-fast` | `150ms` |
| `--duration-panel` | `280ms` |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |

Do not invent per-component durations. All motion is wrapped in
`@media (prefers-reduced-motion: reduce)` and disabled there.

---

## Component patterns inherited from Konnekt

| Pattern | Shape |
|---|---|
| Panel / tile | `--radius-panel` + `--border-hairline` over `--bg-surface` |
| Segmented control | Pill container, sliding accent indicator at `--radius-lg` minus 1px |
| Toggle | `20×36px` pill, `16px` knob, accent when on, `--border-hover` when off |
| Row divider | `border-bottom: var(--border-hairline) solid var(--border-subtle)` |
| Scrollbar | `4px`, `--border-hover` thumb, transparent track |
| Value text | Monospace, `--text-xs`, `--text-secondary` |

The sliding-indicator radius is `--radius-lg` minus 1px so it sits concentrically
inside the container border. Concentric radii matter at hairline weights —
mismatched values rasterise unevenly and read as a rendering bug.

---

## Adding a token

1. Add it to the token source and run `pnpm gen:tokens`.
2. If components should reach it as a utility, map it in `@theme inline`.
3. Name it by **role**, not appearance.
4. Commit the regenerated `tokens.css` alongside the source change.

Never edit `src/styles/tokens.css` directly — it is overwritten.
