---
paths:
  - src/components/**
  - src/routes/**
---

# Styling in components

**Why this rule exists:** Tailwind's arbitrary-value syntax makes inlining a literal
the path of least resistance — `text-[10px]` is quicker than checking whether a
token exists, and it looks idiomatic. The project this design language came from
does exactly that in over a hundred places. Kommands does not, because runtime
theming works by overriding custom properties: an inlined value silently opts that
element out of theming, and the breakage only appears in a non-default theme.

## No literal hex, no literal px

Use `var(--token)` or a semantic Tailwind utility.

```tsx
<div className="text-2xs border-hairline border-border-subtle" />   // right
<div className="text-[10px] border-[0.5px] border-white/6" />       // wrong
<div style={{ color: '#4ade80' }} />                                // wrong
```

`/suite-kit:health` greps these paths for `#[0-9a-f]{3,8}` and `\[[0-9.]+px\]` and fails
on a hit.

## Every value has a token — including the awkward ones

The token scale deliberately names the steps that would otherwise be inlined:
`--text-3xs` (9px), `--text-2xs` (10px), `--border-hairline` (0.5px),
`--radius-panel` (10px).

**If a value seems to be missing, add a token.** Do not inline it, and do not
approximate with a nearby token. Adding a token is a normal, expected change; see
`docs/design-tokens.md`.

## Name tokens by role

`--bg-elevated`, not `--grey-800`. Appearance-named tokens become lies the moment
a theme changes them.

## There are no shadows

Elevation comes from translucent surfaces plus hairline borders. The design language
uses **zero** drop shadows, and there are no shadow tokens.

The single permitted `box-shadow` is an accent-tinted glow inside a keyframe:

```css
box-shadow: 0 0 20px 4px rgb(var(--accent-rgb) / 0.2);
```

If a component seems to need a drop shadow, it needs a different surface or border.

## Alpha composes from channel triplets

Status colours are stored as `--accent-rgb: 74 222 128`, so alpha needs no second
token:

```css
color: var(--accent);                     /* solid */
background: rgb(var(--accent-rgb) / 0.2); /* 20% */
```

## Motion uses the shared vocabulary

`--duration-fast` (150ms), `--duration-panel` (280ms), `--ease-standard`. Do not
invent per-component durations. Wrap motion in
`@media (prefers-reduced-motion: reduce)`.

## No game values here either

Item IDs, entities, and enchantments come from the version registry via props or a
store — never a literal in a component. Components render data; they do not know
Minecraft.

## Related

- `docs/design-tokens.md` — the full token set and pipeline
