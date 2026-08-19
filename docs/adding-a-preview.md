# Adding a 3D preview

Previews are first-class: a command definition declares one the same way it
declares arguments. They are lazy-loaded, so Three.js never enters the main bundle,
but the abstraction is not conditional on that.

---

## The contract

**A preview module receives parsed argument values, never the command string.**

This is the rule that keeps previews decoupled. A module that parses command text
would depend on the serializer and on version traits, and would break every time
syntax changed. Modules see structured values and know nothing about syntax eras.

Corollaries:

- A preview never imports a serializer.
- A command definition never imports Three.js.
- The shared canvas owns renderer, camera, and lights; modules contribute scene
  content only.

---

## Binding a preview to a definition

```ts
preview: {
  module: 'worldedit/shape',
  inputs: ['expression', 'pattern', '-h'],
}
```

| Field    | Meaning                                       |
| -------- | --------------------------------------------- |
| `module` | Key into the preview registry                 |
| `inputs` | Argument and flag `name`s the module observes |

`inputs` names must resolve against `ArgumentNode.name` or `FlagSetNode` flag names
in the same definition. This is validated at build time — a typo fails the build
rather than rendering an empty canvas.

The renderer re-renders the preview only when a named input changes, so unrelated
edits do not trigger recomputation.

---

## Writing a module

Create `src/previews/<namespace>/<name>/`.

### 1. Register it

```ts
export const shapePreview: PreviewModule = {
  id: 'worldedit/shape',

  // dynamic import — keeps Three.js out of the main bundle
  load: () => import('./ShapePreview'),

  // build-time validation of the binding
  accepts: (def) => def.dialect === 'worldedit' && hasArgument(def, 'expression', 'we_expression'),
}
```

`accepts` runs at build time. Assert the argument **types** it depends on, not just
their names — that way a definition change that breaks the module is caught in CI
rather than at runtime.

### 2. Implement the component

```tsx
export default function ShapePreview({ values, registry }: PreviewProps) {
  const { expression, pattern, '-h': hollow } = values
  // compute scene content from values
  return <>{/* meshes, points, instanced geometry */}</>
}
```

`PreviewProps`:

| Prop       | Contents                                                      |
| ---------- | ------------------------------------------------------------- |
| `values`   | Parsed values for the declared `inputs`, keyed by name        |
| `registry` | The active version registry, for resolving block and item IDs |

The component renders **inside** the shared `<PreviewCanvas>`. Do not create a
renderer, scene, or camera.

### 3. Performance

Previews run on every relevant keystroke.

- Debounce expensive recomputation; the canvas does not do it for you.
- Use instanced geometry for voxel output — a 64³ region is 262,144 candidate
  positions.
- Cap the evaluated volume and surface the cap in the UI rather than freezing the
  tab.
- Dispose geometries and materials on unmount.

### 4. Degradation

A preview is **always optional**. If evaluation fails or input is incomplete, show
an empty canvas with an inline message. Never block command output on preview
state — the generated command is the product; the preview is an aid.

---

## Checklist

- [ ] Module reads parsed values, never command text
- [ ] `accepts` validates argument types, not just names
- [ ] `load` uses a dynamic import
- [ ] No renderer, scene, or camera created in the module
- [ ] Expensive work debounced; volume capped
- [ ] Geometries and materials disposed on unmount
- [ ] Failure degrades to an empty canvas with a message
- [ ] `/suite-kit:health` passes

---

## First module: `worldedit/shape`

Previews `//generate` — evaluates its expression across the selection region and
renders the resulting voxels.

**This carries a hidden cost:** it needs an evaluator for WorldEdit's expression
language (variables `x`/`y`/`z`, arithmetic, comparisons, and WorldEdit's built-in
functions). That evaluator is not derivable from any data source and must be
written and tested independently of the preview itself. It is the largest single
piece of work in the preview roadmap — see [`roadmap.md`](roadmap.md).

Build and test the evaluator as a standalone module with its own fixtures before
wiring it to a canvas.
