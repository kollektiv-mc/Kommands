# The `//generate` editor

The design decision behind the 3D editor for `//generate`, and the evidence for it.
Everything here was read out of the WorldEdit source rather than recalled; the file
paths are given so the next reader can re-check rather than trust.

Scope, sequencing and status live in [`roadmap.md`](roadmap.md) and the issues. This
file answers one question: **what shape is the tool, and why that shape.**

---

## What `//generate` actually does

`EditSession.makeShape` walks every position in the selection and, per position:

```java
if (expression.evaluate({x, y, z, type, data}, timeout) <= 0) return null;  // no block
int newType = typeVariable.value();
int newData = dataVariable.value();
// the expression may have *reassigned* type/data — if so that wins over the pattern
```

Three facts follow, and all three shape the tool:

1. **The expression is a predicate.** Greater than zero places a block; zero or less
   places nothing. There is no partial occupancy and no per-voxel opacity.
2. **`x`, `y`, `z` are normalised**, not world coordinates. By default they run −1..1
   across the selection; `-r` uses raw world coordinates, `-o` the placement position,
   `-c` the selection centre. `TransformUtil.createTransformForExpressionCommand`
   checks those three in that order and returns on the first, which is why the origin
   modes silently override each other rather than conflicting.
3. **The expression can also choose the material.** `type` and `data` are writable
   variables, so a formula can pick a block per voxel rather than deferring to the
   pattern. They are _legacy_ numeric ids, so this channel reaches only pre-flattening
   blocks — a real limit on using it for shading.

---

## How much freedom the command has

This is the question that decides how large the tool is. Measured against
`worldedit-core/src/main/java/com/sk89q/worldedit/`.

### The expression language is a real language

`internal/expression/` — an ANTLR grammar (`antlr/…/Expression.g4`, 237 lines) with:

- **Control flow**: `if`/`else`, `while`, `do…while`, C-style `for`, range `for`,
  `switch`/`case`/`default`, `break`, `continue`, `return`
- **Operators**: `+ - * / % ^ **`, `<< >>`, `~`, `! && ||`, `== != ~= < <= > >=`,
  ternary, `++ --`, and the compound assignments
- **Maths**: `sin cos tan asin acos atan sinh cosh tanh sqrt cbrt abs ceil floor rint
exp log log10 ln round atan2 min max`
- **Noise**: `perlin`, `voronoi`, `ridgedmulti`
- **Randomness**: `random`, `randint`
- **Persistent memory**: `megabuf`, `gmegabuf` — scratch storage indexed by an integer,
  surviving between voxels; plus `closest`/`gclosest`, which scan it for the nearest of
  a run of stored points
- **Assignment through arguments**: `rotate(x, y, angle)` and `swap(x, y)`, the only two
  functions that write back to what they are passed. `rotate` is how a shape is tilted
- **World reads**: `query`, `queryAbs`, `queryRel` — the expression can inspect **blocks
  that already exist**

That last group is **out of scope**, with world masking, for the reasons below. A browser
has no world to read, so these can be written but never shown.

`getBlockType`, `getBlockTypeAbs` and `getBlockTypeRel` read like a fourth world-reading
group and are not one: in `Functions.java` they are `ExpressionEnvironment` methods that
`query` calls internally, carrying no `@ExpressionFunction`. An expression cannot call
them. Likewise `getBufferItem`/`setBufferItem` are private helpers behind `megabuf`, not
names the language exposes. All five are worth naming here precisely because they look
callable — treating them as unavailable-but-real would tell someone their command works
in game when it does not.

### That language is implemented here, and written rather than generated

`src/worldedit/expression/` — lexer, parser, compiler, built-ins. Two decisions in it
are worth recording, because both look wrong at first glance.

**Written, not generated.** `Expression.g4` is target-neutral — no Java actions, no
`@header` or `@members` — so `antlr4ng` could generate a parser from WorldEdit's own
grammar. It was not used. A generated parser adds a runtime dependency to the entry
chunk, still needs a visitor written by hand to reach a closure tree, and does not
help with the part that is actually hard. 34 parser rules with textbook precedence is
a precedence-climbing parser of a few hundred lines; the semantics below are the work.

**Specified by upstream's tests, not by this document.** There is no written spec for
this language. `ExpressionTest.java` and `RealExpressionTest.java` are it, and they are
transcribed into `expression.test.ts` rather than paraphrased — a case that disagrees
with upstream is this implementation being wrong. Four of them are traps that an
implementation written from intuition fails while passing everything else:

| Looks like                     | Actually                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `^` is xor                     | **exponentiation**, **left**-associative and looser than every prefix operator — `2^3^2` is 64 and `-2^2` is 4 |
| postfix `!` is negation        | **factorial**, from a 171-entry table, truncating its input                                                    |
| `&&` and `\|\|` yield booleans | they yield an **operand** — `0 \|\| 5` is `5`, `2 \|\| 5` is `2`, `5 && 0` is `0`                              |
| `~=` is a tolerance            | **units in the last place**, compared as integers                                                              |

The compiler emits a closure tree rather than an interpreter over the AST, because the
consumer evaluates it 262,144 times per input change. See
[`health-checklist.md`](health-checklist.md) § 4.

### Patterns are six grammars, not one

`extension/factory/parser/pattern/`:

| Form                | Syntax                     | Meaning                               |
| ------------------- | -------------------------- | ------------------------------------- |
| Single block        | `stone`, `oak_log[axis=x]` | one block, optionally with states     |
| Weighted random     | `50%stone,50%dirt`         | relative chances, comma-separated     |
| Block category      | `##logs`, `##*wool`        | a block tag; `*` expands states       |
| Random state        | `*oak_log`                 | random value for every state property |
| Clipboard           | `#clipboard`, `#copy`      | sample from the clipboard             |
| Type-or-state apply | `^oak_log`, `^[axis=x]`    | change type or state, keep the rest   |

Weights are **relative chances, not percentages** — `50%stone,50%dirt` and
`1%stone,1%dirt` are the same pattern. A weight on a _single_ entry never parses:
`RandomPatternParser` returns null for a one-token input and the plain block parser
does not understand `%`.

### Masking means geometry masking, and nothing else

"Put a torus inside a torus, but only where there is stone" is two different operations
wearing one word. Only one of them is in scope.

**Geometry masking** — torus ∩ torus — is about shapes the tool itself created. It is
constructive solid geometry: it compiles to `&&`, it stays inside the one expression, and
it previews exactly. This is what the editor offers.

**World masking** — "only where there is stone" — is **ruled out**, and recorded here so
it is not proposed again. It is about blocks already in a world the browser has never
seen, and both routes to it are bad ones:

- `//gmask` is a **separate, stateful, global** command (`GeneralCommands.java:389`) —
  `//generate` takes no mask of its own. A tool offering world masks would emit an
  _ordered pair_ of commands, and could preview neither.
- `query()` inside the expression avoids the second command and is worse. It works in
  **legacy numeric ids** through `LegacyMapper`, and
  `WorldEditExpressionEnvironment.getLegacy` returns `-1` for anything without one.
  Measured against the pinned 1.21.1 block registry, it reaches **444 of 1060 block
  types — 41.9%**. Everything from the 1.13 flattening onward is invisible to it:
  deepslate, copper, blackstone, amethyst, calcite, tuff, mud, cherry, bamboo. A mask
  built this way silently does nothing for most blocks anyone would name.

Neither is worth the tool it would cost, and a preview that cannot show what a mask does
is not a preview. So the editor masks geometry against geometry, and the world-reading
half of the expression language is out of scope with it.

---

## The two candidate architectures

The editor is a 3D web tool where someone builds a shape and gets a `//generate`
command out of the bottom. Two ways to produce that command.

### A — accumulate: every edit appends to the command

### B — derive: sculpt freely, then read the finished voxels back into a command

**B is the intuitive choice and it does not work.** Not because it is hard, but
because of what it is asking for: given an arbitrary set of voxels, find a closed-form
expression whose truth set is exactly that set. That is program synthesis over a
language with loops and memory. In the general case there is no short answer, and the
only _guaranteed_ answer is enumeration:

| Sculpt            |  Voxels | Enumerated expression |
| ----------------- | ------: | --------------------: |
| A 16-block doodle |      16 |            ~370 chars |
| An 8³ solid       |     512 |         ~11,800 chars |
| A 32³ shell       |   6,146 |        ~141,000 chars |
| Half a 64³ region | 131,072 |      ~3,000,000 chars |

Against a command-block ceiling of ~32,500 characters, enumeration fails at roughly an
8³ sculpt. Against a chat line it fails at a doodle. **B fails its own goal —
"don't overcrowd the command" — sooner and worse than A does**, because its output
grows with the number of _voxels_ while A's grows with the number of _operations_.

The instinct behind B is still right, though. What B is really objecting to is a
command that faithfully transcribes twenty fiddly edits. The fix for that is not to
throw the history away; it is to **simplify** it.

### What A costs, when the tools are shaped like the language

A is only viable if the editor's primitives are expression-shaped. They can be, because
constructive solid geometry _is_ boolean algebra, and the language has the operators:

| In the editor         | In the expression        |
| --------------------- | ------------------------ |
| Union                 | `\|\|`                   |
| Intersect             | `&&`                     |
| Subtract              | `&& !`                   |
| Move / scale / rotate | substitute `(x-dx)/sx` … |
| Primitive             | a formula                |

And primitives are short:

```
sphere            x^2+y^2+z^2<1                                        13 chars
box               abs(x)<0.8&&abs(y)<0.5&&abs(z)<0.8                   34
torus             (1-sqrt(x^2+z^2))^2+y^2<0.1                          27
sphere − sphere   (x^2+y^2+z^2<1)&&!((x-0.3)^2+y^2+z^2<0.7)            41
gyroid            sin(x*6)*cos(y*6)+sin(y*6)*cos(z*6)+sin(z*6)*cos(x*6)<0.2   57
```

A twenty-operation sculpt is a long line, not an impossible one — and it stays legible
enough to hand-edit afterwards, which is worth something on its own.

**Measured, now that the compiler exists** (`src/worldedit/csg/`). The sphere, box,
gyroid and sphere − sphere counts above are what it emits, exactly. The torus is 30
rather than 27, because the table writes its minor radius pre-squared and no
parameterisation of a torus node reproduces that without asking someone for a squared
length. And the twenty-operation sculpt is **348 characters** — 775 with sharing turned
off, which is what the shared-subexpression decision below is worth. Both numbers are
pinned by tests rather than restated here; `compile.test.ts` holds them.

---

## The decision

**The editor's document is an operation tree. The command is a projection of it.**

Not a transcript of user actions (A as stated), and not a scan of the result (B). The
tree holds primitives, transforms and boolean combinators; the command is produced by
compiling that tree, with algebraic simplification on the way out.

This is the same relationship Kommands already has everywhere else: a definition plus a
value tree, serialized to text. The 3D editor is **an argument-type editor whose value
happens to be a CSG tree**, and `we_expression`'s serializer becomes a compiler from
that tree to expression source. That is the shape `item_stack` and `text_component`
already have — Brigadier calls each one opaque token, and everything below it is
authored. Nothing about it needs a new subsystem, and nothing about it touches the
serializer for any other command.

Two properties fall out for free, and both matter:

- **Editing stays reversible.** The tree is the truth, so an operation can be selected,
  re-parameterised or deleted after the fact. A transcript cannot do that and a voxel
  scan has nothing to go back to.
- **Simplification is a pure function on the tree**, testable without a canvas and
  without a browser — the same way the WorldEdit expression evaluator is specified to
  be standalone and fixture-tested.

---

## The layer stack is that decision, given a UI

This file used to recommend a Houdini-style node graph. A working prototype, compiled
against `src/worldedit/csg/` and `src/worldedit/expression/` as they are, was built and
reviewed in November 2026 instead, and it settled on a **layer stack**: the operation
tree drawn as a list, the way an image editor draws layers. It is still the decision
above with an interface. Only the interface changed.

**The model.** Each row is a layer, read top to bottom.

- A **shape** (sphere, box, cylinder, torus, triangle, cone, gyroid, formula, half) carries
  an operation, **Add**, **Cut** or **Overlap**: union, subtract or intersect with
  everything above it. A Cut at the top of a list has nothing to cut from, and the list
  marks it as doing nothing.
- A **group** is one layer to its parent, which is how the stack branches: in A ∪ (B − C),
  C cuts only B because B and C share a group. Nesting is the only branching there is, so
  the document is a tree and maps onto `CsgTree` directly.
- A **modifier** (mirror, distort, array, radial, bend, taper, revolve) acts on every layer
  below it in its own list. Each is a node in `src/worldedit/csg/` that changes its
  child's frame, as a transform does but not linearly: `mirror`, `wave` and `twist`
  (Distort's two kinds), `array`, `radial`, `bend`, `taper` and `revolve`. Like a
  primitive, each acts at the origin along an axis, so a modifier moved or turned in the
  editor is that node between a transform and its inverse.
- A **reference** is another `//generate` command drawn as a ghost beside this one, for a
  build that needs one command per material. It is never part of the command.

The document is `src/worldedit/stack/`: plain data (`layers.ts`) so it can be saved in a
command, sent to a worker and compared for undo, with edits as functions from one stack
to the next (`edit.ts`). `lower.ts` turns it into a `CsgTree`, building each run of
same-op shapes below a modifier once rather than once per shape, composing a turned
placement into one `affine` node, and folding scale into a primitive's size where its
formula allows. `oracle.ts` says what a stack means straight from these rules, shape by
shape through every modifier above it, and the lowering is tested against it on 300
generated stacks, so each of those shortcuts is checked rather than trusted.

**Why a stack and not a graph.** Everything a graph adds over a tree is sharing and
wiring. Sharing is already found by the compiler, which keys it on the emitted text
rather than on the node (see below), so a graph's explicit diamond buys nothing a tree
does not get anyway. What is left is wiring, and a list has none: order is the order of
operations, and a group is a parenthesis.

**Shared parts still compile to variables.** The expression language has assignment,
statement sequencing, and last-statement-as-result. WorldEdit's own tests pin it
(`ExpressionTest.testAssignOps`):

```java
checkTestCase("a=2; a^=3; a", 8);   // sequence, assignment, last value is the result
testCase("return 1; 0", 1);         // explicit return also works
```

So a part used twice becomes one assignment and two references:

```
r = x^2+y^2+z^2; (r<1) && !(r<0.7)
```

That example is also why sharing is keyed on text: a sphere minus a _smaller_ sphere has
no node that occurs twice, so memoising per node finds nothing. Keying on the emitted text
finds it, and declines to share a node reached through two different transforms, because
the coordinate frame is part of the text. Dropping the frame from the key leaves 200
generated graphs passing and only the fixture written for it failing.

Because world masking is out, **every layer in the palette is previewable**. There is no
second class of layer that the viewport can only describe rather than show.

### What the prototype settled

The prototype is the reference for building it; these are the decisions it records, so
that they are not reopened by accident.

- **Placement.** The sheet's preview of `//generate` has an Open editor button that opens
  this editor full screen; **Done** returns to the sheet. Opening grows a picture of the
  preview to fill the area below the app header, scaled evenly and cropped, never
  squeezed. The header and the tiles then slide in over it from their own edges, and
  the live view takes its place underneath; Done runs it backwards
  (`src/lib/editorMotion.ts`). The editor is the shape preview module's `editor`
  (`docs/adding-a-preview.md` § A full-screen editor), so the sheet never names the
  command. Done writes the expression, the pattern and `-h` as one undo step, and the
  layers are saved inside the expression's value (`we-expression.ts`), so the editor
  opens a saved command where it left off. A command typed by hand opens as one Formula
  layer holding its text.
- **Layout.** The 3D view fills the editor behind everything. Over it sit an opaque
  header, then the shapes panel and the inspector, then the command bar, one gutter
  apart and one gutter from the edges. The gap between the panels is an opening onto
  the view that holds its controls and passes the pointer through, as do the gutters,
  so dragging anywhere outside a tile orbits. The camera is framed on that opening,
  taken when the camera is reset, so the build sits centred between the tiles.
  Tiles resize from the gaps between them.
- **View and Edit modes**, on Esc and Enter. Only Edit shows the move, turn and scale gizmo,
  with a Snap split button.
- **Mouse.** Left drag orbits, right drag zooms, middle drag pans, all around the point
  under the cursor: the build if the cursor is on it, else a plane through the build's
  centre facing the camera, else the floor within reach, else the camera turns in place.
  Middle drag on a number field is a value ladder. Key hints show only while Alt is held.
- **View menu.** Blocks or Shapes; Coloured, Solid or Wireframe shading (references
  follow it); Cutaway, which follows the camera live; X-ray, Selection box, Grid, Axes, and
  a to-scale Player.
- **Ground.** `x`, `y` and `z` run −1..1 across block _centres_, so the outer blocks reach
  half a block past that. The selection box, grid, floor and player sit on the blocks'
  outer faces, and every template's lowest parts reach below −1, so its bottom layer is
  filled at 32³, 64³ and 128³. The templates are data in `src/data/authored/generate/`,
  one file each, with that offset written into their coordinates.
- **Command bar.** Hollow (`-h`) and Round numbers above the Blocks field; the field opens
  a block mix (one row per block, its chance at the right) and its swatches stack in a
  fixed width. The command box reports whether the command fits in chat (256) or a command
  block (32,500), and how many parts are shared.
- **Copy rules.** No help text in the editor, tooltips only, and no native `title`
  tooltips. Motion animates only `transform` and `opacity` and respects reduced motion.

---

## Limits worth knowing before building

These are the places the tool cannot be faithful, and each needs a decision rather than a
discovery halfway through.

1. **Randomness is not reproducible.** `random` and `randint` make the preview and the
   in-game result differ. The noise functions are seeded and could be matched, but only
   by porting `jlibnoise` exactly — see 4.
2. **`megabuf`/`gmegabuf` carry state between invocations**, so an expression using them
   is not a pure function of position and cannot be evaluated per-voxel in isolation.
3. **Material selection via `type`/`data` is legacy-only**, so shading through the
   expression reaches only pre-flattening blocks. Patterns are the better channel.
4. **Noise must be ported, not approximated.** `perlin`, `voronoi` and `ridgedmulti` come
   from `jlibnoise` (`worldedit-core/build.gradle.kts:38`). An approximation would render
   a shape the command does not produce, which is worse than rendering nothing. Until the
   port exists these evaluate to a diagnostic.
5. **The evaluated volume must be capped and the cap surfaced.** A 64³ region is 262,144
   evaluations per input change, and the expression language has loops — so the evaluator
   also needs a per-evaluation step budget, not just a volume cap.
6. **A face exactly on the edge of the selection loses that layer.** WorldEdit maps the
   selection's outer blocks to exactly ±1 (`TransformUtil.createTransformForExpressionCommand`
   scales by `max - center`), and the compiler writes every primitive with a strict `<`,
   so `abs(y)<1` leaves the bottom layer empty in game. Switching to `<=` is not the fix: it
   puts single-block bumps on every sphere. A shape meant to touch the edge has to reach
   past it.

   **Decided: an authoring rule, not a compile-time nudge.** Shrinking the coordinates
   by a hair before every comparison would fill the edge layer, and it is `<=` again by
   another route: a sphere of radius 1 grows a block at each pole, and every face that sits
   exactly on a block centre anywhere in the volume moves a layer. What the editor does
   instead is draw the truth: the selection box, grid and floor sit on the blocks' outer
   faces, half a block past ±1, so a shape dragged down onto the floor already reaches
   past the edge. And every template's grounded parts reach below −1, which a test checks
   at 32³, 64³ and 128³ rather than a table of measured offsets.

Also out of scope, and recorded above rather than here because it is a decision rather
than a limit: **world masking**, and with it the world-reading functions `query`,
`queryAbs` and `queryRel`.

---

## Related

- [`command-schema.md`](command-schema.md) — the schema this fits into without change
- [`adding-a-preview.md`](adding-a-preview.md) — the preview module contract: modules
  receive **parsed argument values, never the command string**
- [`roadmap.md`](roadmap.md) — where this sits, and what blocks it
