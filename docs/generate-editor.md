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
- **Persistent memory**: `megabuf`, `gmegabuf`, `getBufferItem`, `setBufferItem` —
  scratch storage that survives between voxels and between invocations
- **World reads**: `query`, `queryAbs`, `queryRel`, `getBlockType`, `getBlockTypeAbs`,
  `getBlockTypeRel` — the expression can inspect **blocks that already exist**

That last group is the one with teeth. An expression that reads the world cannot be
evaluated correctly by a browser that does not have the world. See _Limits_ below.

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

### Masks are sixteen grammars, and they compose

`extension/factory/parser/mask/`, combined by `MaskFactory.parseFromInput`:

```java
for (String component : input.split(" ", 0)) { … }
return switch (masks.size()) { … default -> new MaskIntersection(masks); };
```

**Space-separated masks intersect.** So `#solid >air !##logs` means solid AND
air-above AND not-a-log. Available: `#air #existing #solid #exposed #surface #fullcube
#region #selection #sel #dregion #dsel #clipboard`, `##tag`, `^[state]`, `$biome`,
`%noise`, `=expression`, `!negate`, and the offset masks `>` `<` `~`.

Note `=expression` — a mask can itself be an expression, which is a second place the
language appears.

### `//generate` does not take a mask

Its signature is `pattern` then a variadic `expression`, plus the four switches.
Masking comes from `//gmask`, a **separate, stateful, global** command
(`GeneralCommands.java:389`). This matters: masking is not part of the command being
generated, so a tool that offers masking is generating _two_ commands with an ordering
dependency between them.

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

## Limits worth knowing before building

These are the places the tool cannot be faithful, and each needs a decision rather
than a discovery halfway through.

1. **World-reading expressions cannot be previewed.** `query`, `queryRel` and the
   `getBlockType*` family read blocks that exist in a world the browser does not have.
   Any expression using them can be _written_ but not _shown_. The preview has to say
   so rather than render a confident lie.
2. **Randomness is not reproducible.** `random`, `randint` and the noise functions
   make the preview and the in-game result differ. Noise is seeded; `random` is not.
3. **`megabuf`/`gmegabuf` carry state between invocations**, so an expression using
   them is not a pure function of position and cannot be evaluated per-voxel in
   isolation.
4. **Material selection via `type`/`data` is legacy-only**, so shading through the
   expression reaches only pre-flattening blocks. Patterns are the better channel.
5. **Masking is a second command.** `//gmask` is global and stateful, so a tool
   offering masks emits an ordered pair of commands, not one.
6. **The evaluated volume must be capped and the cap surfaced.** A 64³ region is
   262,144 evaluations per input change, and the expression language has loops.

---

## Related

- [`command-schema.md`](command-schema.md) — the schema this fits into without change
- [`adding-a-preview.md`](adding-a-preview.md) — the preview module contract: modules
  receive **parsed argument values, never the command string**
- [`roadmap.md`](roadmap.md) — where this sits, and what blocks it
