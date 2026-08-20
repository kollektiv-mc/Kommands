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

That last group is **out of scope**, with world masking, for the reasons below. A browser
has no world to read, so these can be written but never shown.

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

| Looks like                     | Actually                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `^` is xor                     | **exponentiation**, right-associative (`POWER : '^' \| '**'`)                     |
| postfix `!` is negation        | **factorial**, from a 171-entry table, truncating its input                       |
| `&&` and `\|\|` yield booleans | they yield an **operand** — `0 \|\| 5` is `5`, `2 \|\| 5` is `2`, `5 && 0` is `0` |
| `~=` is a tolerance            | **units in the last place**, compared as integers                                 |

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

## The node graph is that decision, given a UI

A Houdini-style procedural graph — nodes wired together, a 3D viewport beside them, the
command updating live underneath — is **not an alternative to the operation tree. It is
the operation tree with an interface.** Source nodes are primitives, filter nodes are
transforms, merge nodes are the boolean combinators, and the terminal node is what gets
compiled. Three views of one document: the graph edits it, the viewport evaluates it,
the command serializes it. That is the same relationship this repo already has between a
definition, a value tree and command text — see [`architecture.md`](architecture.md).

Three things are worth being precise about before building it.

**It is a DAG, not a chain.** A boolean node takes two inputs, so the wiring branches and
re-merges. Houdini is the same — its merge nodes are n-ary. A strictly linear chain
cannot express "torus A intersected with torus B" at all.

**Shared outputs compile to variables, not to duplicated text.** This is what makes a
graph — rather than a tree — safe to compile, and it is the finding that decides the
whole question. The expression language has assignment, statement sequencing, and
last-statement-as-result. WorldEdit's own tests pin it
(`ExpressionTest.testAssignOps`):

```java
checkTestCase("a=2; a^=3; a", 8);   // sequence, assignment, last value is the result
testCase("return 1; 0", 1);         // explicit return also works
```

So a node whose output feeds two consumers becomes one assignment and two references:

```
r = x^2+y^2+z^2; (r<1) && !(r<0.7)
```

Without that, a diamond in the graph would duplicate its shared subexpression on every
path — the blow-up that made the scan-and-derive route fail, arriving by another door.

**Live update should cook the dirty subgraph, not the whole graph.** A node graph makes
the dependency edges explicit, so a parameter change only invalidates nodes downstream of
it. That is Houdini's own model, and it is what makes the preview budget in
[`health-checklist.md`](health-checklist.md) achievable at 64³ — 262,144 evaluations per
input change is only affordable if most inputs do not touch most nodes.

One consequence for the graph's vocabulary: because world masking is out, **every node in
the palette is previewable**. There is no second class of node that the viewport can only
describe rather than show, and that is worth protecting — a palette where some nodes
render and others merely promise is a palette that has to explain itself.

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

Also out of scope, and recorded above rather than here because it is a decision rather
than a limit: **world masking**, and with it the world-reading functions `query`,
`queryAbs`, `queryRel` and the `getBlockType*` family.

---

## Related

- [`command-schema.md`](command-schema.md) — the schema this fits into without change
- [`adding-a-preview.md`](adding-a-preview.md) — the preview module contract: modules
  receive **parsed argument values, never the command string**
- [`roadmap.md`](roadmap.md) — where this sits, and what blocks it
