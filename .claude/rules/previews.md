---
paths:
  - src/previews/**
---

# 3D preview modules

**Why this rule exists:** the obvious way to build a preview is to read the command
string the app already generates — it is right there, and it is one input instead of
several. That coupling makes every preview depend on the serializer and on version
traits, so a syntax change in a future Minecraft version silently breaks previews
that have nothing to do with syntax. The second failure mode is performance:
previews recompute on every keystroke, and a naive voxel loop freezes the tab.

## Read parsed values, never command text

```tsx
function ShapePreview({ values }: PreviewProps) {
  const { expression, pattern } = values // right — structured values
}
```

A preview module must **never** parse a command string, import a serializer, or know
which syntax era is active.

## Never create a renderer, scene, or camera

The shared `<PreviewCanvas>` owns all three. Modules contribute scene content only.
A module that creates its own renderer produces a second WebGL context and leaks it.

## Load lazily, always

```ts
load: () => import('./ShapePreview')
```

A static import pulls Three.js into the main bundle and defeats the whole
arrangement. The abstraction is eager; the code is lazy.

## Validate bindings by type in `accepts`

```ts
accepts: (def) =>
  def.dialect === 'worldedit' &&
  hasArgument(def, 'expression', 'we_expression'),
```

Assert the argument **types** the module depends on, not just their names. This runs
at build time, so a definition change that breaks the module fails CI rather than
rendering an empty canvas in production.

## Budget the work

Previews recompute on every relevant input change.

- Debounce expensive recomputation — the canvas does not do it for you
- Use instanced geometry for voxels; a 64³ region is 262,144 candidate positions
- Cap the evaluated volume and **surface the cap in the UI** rather than freezing
- Dispose geometries and materials on unmount

## Failure degrades, never blocks

On invalid or incomplete input, render an empty canvas with an inline message. The
generated command is the product; the preview is an aid. Preview state must never
gate command output.

## Related

- `docs/adding-a-preview.md` — full module contract
- `docs/architecture.md` § Previews
