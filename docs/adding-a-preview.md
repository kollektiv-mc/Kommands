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
export default function ShapePreview({ values, report }: PreviewProps) {
  const { expression, pattern, '-h': hollow } = values
  report({ cap: '32³ samples' })
  return <>{/* meshes, points, instanced geometry */}</>
}
```

`PreviewProps`:

| Prop       | Contents                                                      |
| ---------- | ------------------------------------------------------------- |
| `values`   | Parsed values for the declared `inputs`, keyed by selector    |
| `registry` | The active version registry, for resolving block and item IDs |
| `report`   | Say what was drawn, or why nothing was — see below            |

The component renders **inside** the shared `<PreviewCanvas>`, which is to say inside a
`<Canvas>`. Do not create a renderer, scene, or camera.

### `report`, and why it exists

A module contributes scene content, so there is no DOM inside it to put a sentence in —
but two things only the module knows have to reach the user: **why there is nothing to
draw**, and **what it capped**. Both travel back through `report`, and the shell renders
them. Without it a module would have to own DOM chrome, which is one short step from
owning a renderer.

```ts
report({
  message: 'Enter an expression to see the shape.', // why nothing is drawn
  diagnostics: compiled.diagnostics, // warnings, shown, never blocking
  cap: '32³ samples', // the cap, surfaced rather than silent
})
```

`report` is stable across renders, so calling it from an effect does not make the
callback a reason to run that effect again.

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
- [ ] Meaning lives in a headless file; the component only draws
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
renders the resulting voxels. **Built**, in `src/previews/worldedit/shape/`.

Its hidden cost was the expression evaluator, which is not derivable from any data
source; that was built and fixture-tested standalone first, in
`src/worldedit/expression/`, and the advice to do it that way generalises: **put the
meaning in a headless file and let the component only draw it.** jsdom has no WebGL, so
anything computed inside a canvas component is untestable, and `voxels.ts` is where this
module's meaning lives for exactly that reason.

Two findings from building it that the next module will meet too:

- **`-h` is not "remove the interior".** WorldEdit's `ArbitraryShape.getMaterial` keeps a
  position when any one of its **six axis neighbours** is outside — and its cache spans
  one layer beyond the region and _evaluates the expression there_, so a shape that
  reaches the selection face is not shelled at that face. `evaluateGrid` takes a `pad`
  option for this. Reading the Java was the only way to get either detail right.
- **The token layer's colours are channel triplets, and Three cannot read the derived
  form.** `--accent` is `rgb(74 222 128)`; `new Color('rgb(74 222 128)')` silently
  returns white. Read `--accent-rgb` and build the colour from the numbers, in
  `SRGBColorSpace`. See `src/previews/worldedit/shape/color.ts`.
