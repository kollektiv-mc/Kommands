# Command schema

The authoritative reference for command definitions. Rationale lives in
[`architecture.md`](architecture.md); this document defines the shape.

---

## `CommandDefinition`

```ts
interface CommandDefinition {
  /** Stable unique key: '<dialect>:<name>'. Used for routing and Ref nodes. */
  id: string

  /** Display name, e.g. '/give'. */
  label: string

  /** Which syntax family this belongs to. Drives serialization and rendering. */
  dialect: 'vanilla' | 'worldedit'

  /** Where this definition came from. 'derived' files must never be hand-edited. */
  provenance: 'derived' | 'authored'

  /** Versions this definition applies to. See docs/minecraft-versions.md. */
  versions: VersionRange

  /** Alternative invocations, e.g. ['//gen', '//g'] for //generate. */
  aliases?: string[]

  /** The argument tree. */
  root: Node

  /** Cross-argument rules the tree cannot express. */
  constraints?: Constraint[]

  /** Optional 3D preview binding. See docs/adding-a-preview.md. */
  preview?: PreviewBinding

  /** Presentation metadata — labels, grouping, help text. Always authored. */
  ui?: UiMetadata
}
```

`dialect` and `provenance` are independent. A WorldEdit definition is
`worldedit` + `authored`; a vanilla one is `vanilla` + `derived`. A hand-written
vanilla definition — a temporary override, say — is `vanilla` + `authored`, and is
legal.

---

## `Node`

A discriminated union on `kind`. The tree, not a flat list, because `/execute`
recurses and embeds other commands.

```ts
type Node =
  LiteralNode | ArgumentNode | SequenceNode | ChoiceNode | RepeatNode | FlagSetNode | RefNode
```

### `LiteralNode`

A fixed token: the command name, or a subcommand keyword.

```ts
{ kind: 'literal', token: string }
```

### `ArgumentNode`

A user-supplied value. `type` is a key into the argument-type registry.

```ts
{
  kind: 'argument'
  name: string              // how constraints and previews address it; see invariant 1
  type: ArgumentTypeKey
  typeOptions?: object      // passed to the editor and validator, e.g. { min: 1 }
  optional?: boolean        // derived from Brigadier `executable` flags
  variadic?: boolean        // consumes all remaining tokens, joined with spaces
  default?: unknown
}
```

### `SequenceNode`

Ordered children. All non-optional children must be satisfied.

```ts
{ kind: 'sequence', nodes: Node[] }
```

### `ChoiceNode`

Exactly one child applies — the `/execute` subcommand alternatives — or, when
`optional` is set, none of them.

```ts
{
  kind: 'choice'
  nodes: Node[]
  optional?: boolean        // derived from Brigadier `executable` flags
}
```

`optional` is how a **clause** is skipped, as against `ArgumentNode.optional`, which
skips a **value**. The two are not interchangeable: Brigadier marks a node
`executable` when the command may end there, and the continuation is frequently
keyword-led. `/particle … <count>` is a finished command and `force|normal` is a tail;
`/difficulty` is a finished command and `peaceful|easy|normal|hard` is a tail. Neither
tail begins with an argument, so there is no `ArgumentNode` on which to hang the fact.

A Choice with no branch selected serialises to nothing. This is the one place the
default matters: a non-optional Choice with no selection recorded means the _first_
branch, because one of them must apply; an optional one means _none_, because that is
the state a fresh command starts in. Reading the absent case as "first" for both is
what made every untouched `/difficulty` emit `/difficulty peaceful`.

A single-branch optional Choice is not a degenerate case — it is how "this clause, or
nothing" is written when there is only one clause. `/execute`'s `run <command>` tail
is exactly that.

### `RepeatNode`

Child may appear multiple times. This is how Brigadier `redirect` is represented.

```ts
{ kind: 'repeat', node: Node, min?: number, max?: number }
```

`max` is enforced where an instance is created: the store refuses to add past it and the
`+ add` control is not offered, the same way the remove control is withheld at `min`.

Each instance carries a generated **id**, and its path keys on that id rather than on its
position — `/1/#i3`, not `/1/#0`. So the order of a Repeat's id list is the order of its
clauses, and reordering is a permutation of that list which touches no value key at all.
The ordinal form was the other way round: a clause's path stated where it currently sat,
so a reorder had to rewrite every key beneath the Repeat, and React — seeing the same
keys in the same order — handed each mounted editor a different clause's props while its
internal state, its focus and its caret stayed at the slot. An id is opaque: nothing
parses one back out of a path.

### `FlagSetNode`

Boolean switches. WorldEdit only; vanilla has no equivalent.

```ts
{
  kind: 'flagset'
  flags: Array<{
    name: string // referenced by constraints as '-h'
    char: string // 'h'
    label: string
  }>
}
```

Serialized as a single combined token: `-hro`, not `-h -r -o`.

### `RefNode`

Embeds another command definition. This is `/execute … run <command>`.

```ts
{ kind: 'ref', definitionId: string | '@any' }
```

`'@any'` means any command in the same dialect and version — the renderer offers a
command picker, then renders the chosen definition inline.

A Ref has no `optional` of its own. Every Ref in vanilla is introduced by the keyword
`run`, and dropping the command while keeping the keyword emits `/execute … run` —
worse than either alternative. What is optional is the whole clause, keyword included,
which is a `ChoiceNode` with `optional` set. A Ref that is reached and left unchosen
is therefore required, and serialises as a `<command>` placeholder, the same honesty
an unfilled required argument gets.

---

## `Constraint`

Rules spanning multiple arguments, which the tree shape cannot express.

```ts
{
  kind: 'mutex' | 'requires' | 'range'
  targets: string[]         // argument or flag names
  message: string           // shown to the user when violated
}
```

| Kind       | Meaning                                              |
| ---------- | ---------------------------------------------------- |
| `mutex`    | At most one of `targets` may be set                  |
| `requires` | The first target being set requires the rest         |
| `range`    | Numeric relationship between targets, e.g. min ≤ max |

Constraint violations **warn, never block**. The command still renders; the user
decides.

---

## Argument types

`type` keys into a registry. Each entry supplies:

```ts
interface ArgumentType {
  key: ArgumentTypeKey
  editor: ComponentType<EditorProps> // React editor
  serialize: (value, ctx: SerializeContext) => string
  validate: (value, options, ctx: SerializeContext) => Diagnostic[] // warnings only
  defaultValue: (options) => unknown
}
```

`SerializeContext` carries the version traits, so serializers branch on traits and
never on version numbers.

Types divide into two groups. The distinction determines the derivation failure
policy — see [`architecture.md`](architecture.md).

**Shallow** — generic editors driven by Brigadier `properties`:

| Key                 | From parser                           | Editor                                         |
| ------------------- | ------------------------------------- | ---------------------------------------------- |
| `integer`           | `brigadier:integer`                   | Number input honouring `min`/`max`             |
| `float` / `double`  | `brigadier:float`, `brigadier:double` | Number input                                   |
| `bool`              | `brigadier:bool`                      | Toggle                                         |
| `string`            | `brigadier:string`                    | Text input                                     |
| `block_pos`         | `minecraft:block_pos`                 | Three coordinate fields with `~` / `^` support |
| `vec3` / `vec2`     | `minecraft:vec3`, `minecraft:vec2`    | Coordinate fields                              |
| `resource_location` | `minecraft:resource_location`         | Registry-backed combo box                      |
| `entity_selector`   | `minecraft:entity`                    | Selector builder, constrained by `properties`  |

**Deep** — hand-authored; this is where the product value is:

| Key              | From parser                  | Editor                              |
| ---------------- | ---------------------------- | ----------------------------------- |
| `item_stack`     | `minecraft:item_stack`       | Item picker + data-component editor |
| `text_component` | `minecraft:component`        | Recursive text-component builder    |
| `nbt_compound`   | `minecraft:nbt_compound_tag` | Structured NBT editor               |
| `block_state`    | `minecraft:block_state`      | Block picker + state properties     |
| `we_pattern`     | — (WorldEdit)                | Pattern builder                     |
| `we_expression`  | — (WorldEdit)                | Expression editor                   |

**Fallback** — `raw_text`, a plain text field. Bound automatically when derivation
meets an unmapped deep parser, so an unsupported command degrades instead of
breaking the build.

---

## Worked examples

These four are the acceptance set. A schema change that cannot express all four is
wrong.

### `/give` — sequence with an optional tail

```ts
{
  id: 'vanilla:give', label: '/give', dialect: 'vanilla', provenance: 'derived',
  root: { kind: 'sequence', nodes: [
    { kind: 'literal', token: 'give' },
    { kind: 'argument', name: 'targets', type: 'entity_selector',
      typeOptions: { type: 'players', amount: 'multiple' } },
    { kind: 'argument', name: 'item', type: 'item_stack' },
    { kind: 'argument', name: 'count', type: 'integer',
      typeOptions: { min: 1 }, optional: true },
  ]},
}
```

### `/tellraw` — a deep authored editor

```ts
root: { kind: 'sequence', nodes: [
  { kind: 'literal', token: 'tellraw' },
  { kind: 'argument', name: 'targets', type: 'entity_selector',
    typeOptions: { type: 'players', amount: 'multiple' } },
  { kind: 'argument', name: 'message', type: 'text_component' },
]}
```

The structure is trivial; all the work is inside `text_component`, whose
serialization depends on the `textComponentFormat` trait.

### `/execute` — recursion and command embedding

The case that rules out a flat argument list.

```ts
root: { kind: 'sequence', nodes: [
  { kind: 'literal', token: 'execute' },

  // clauses chain arbitrarily — Brigadier `redirect: ["execute"]`
  { kind: 'repeat', min: 0, node: { kind: 'choice', nodes: [
    { kind: 'sequence', nodes: [
      { kind: 'literal', token: 'as' },
      { kind: 'argument', name: 'as_targets', type: 'entity_selector',
        typeOptions: { type: 'entities', amount: 'multiple' } },
    ]},
    { kind: 'sequence', nodes: [
      { kind: 'literal', token: 'at' },
      { kind: 'argument', name: 'at_targets', type: 'entity_selector',
        typeOptions: { type: 'entities', amount: 'multiple' } },
    ]},
    // … align, anchored, facing, if, in, on, positioned, rotated, store, summon, unless
  ]}},

  // terminal: embeds another command, and may be left out entirely
  { kind: 'choice', optional: true, nodes: [
    { kind: 'sequence', nodes: [
      { kind: 'literal', token: 'run' },
      { kind: 'ref', definitionId: '@any' },
    ]},
  ]},
]}
```

The tail is a one-branch optional `Choice` rather than a bare `Sequence` because every
`if`/`unless` leaf is executable in its own right: `/execute if block ~ ~ ~ stone` is a
finished command, so `run <command>` is a clause the user may skip — keyword included.
A `Sequence` cannot say that. Dropping only the `ref` would leave `/execute … run`,
which is not a smaller command, just a broken one.

### `//generate` — flags, variadic tail, mutual exclusion

```ts
{
  id: 'worldedit:generate', label: '//generate',
  dialect: 'worldedit', provenance: 'authored',
  aliases: ['//gen', '//g'],
  root: { kind: 'sequence', nodes: [
    { kind: 'literal', token: '//generate' },
    { kind: 'flagset', flags: [
      { name: '-h', char: 'h', label: 'Hollow' },
      { name: '-r', char: 'r', label: 'Raw coordinate origin' },
      { name: '-o', char: 'o', label: 'Placement origin' },
      { name: '-c', char: 'c', label: 'Selection centre origin' },
    ]},
    { kind: 'argument', name: 'pattern', type: 'we_pattern' },
    { kind: 'argument', name: 'expression', type: 'we_expression', variadic: true },
  ]},
  constraints: [
    { kind: 'mutex', targets: ['-r', '-o', '-c'],
      message: 'Choose one origin mode.' },
  ],
  preview: { module: 'worldedit/shape', inputs: ['expression', 'pattern', '-h'] },
}
```

Every node kind WorldEdit needs is either shared with vanilla or an addition to the
same schema. None of it requires a second schema — which is why `dialect` is a
field rather than a subsystem boundary.

---

## Invariants

1. A `name` a constraint or a preview **addresses** resolves to exactly one node. It is
   _not_ unique within a definition, and claiming it was is what issue #29 found:
   derived skeletons carry Brigadier's own names, and Brigadier addresses nodes by
   position, so 33 of the 78 have a duplicate — `/execute` has 36 arguments called
   `scale`. See invariant 7 for what replaced it.
2. `provenance: 'derived'` files are overwritten by `pnpm gen:commands`. Never edit
   them; change the generator.
3. Serializers read version traits from `SerializeContext`. A version-number
   comparison in serializer code is a bug.
4. Validation warns; it never blocks output.
5. A `RefNode` must not resolve to its own definition without passing through a
   `RepeatNode` — otherwise rendering does not terminate.
6. Nothing may follow a `variadic` argument, and one may not sit inside a `Repeat`.
   A variadic argument consumes every remaining token, so a node after it is
   unreachable rather than merely unlikely — the form would draw a field that cannot
   affect the command. `definitionProblems` in `src/schema/invariants.ts` checks 6
   against every definition in the catalogue.
7. Every `Constraint.targets` entry and every `PreviewBinding.inputs` entry resolves to
   exactly one node. Checked by `definitionProblems` alongside 6, and this is the
   build-time validation [`adding-a-preview.md`](adding-a-preview.md) requires of
   preview `inputs`.

   A target is a **selector**, not merely a name: a bare name where one is enough, or
   the innermost enclosing keywords where it is not, matched as a contiguous suffix.
   Flags carry their own leading dash.

   ```
   targets                       a bare name, when it means one thing
   result/block/byte/scale       the innermost keywords, when it does not
   -h                            a flag
   ```

   Deliberately not a path — `/1/#i3/|3/2` is positional and dies the moment the deriver
   reshapes the tree, and surviving regeneration is the whole reason rules address by
   name. Deliberately no ordinal form either, which would hand that fragility straight
   back. The cost is that `/loot` and `/teleport` are partly unaddressable — 32 argument
   nodes that Brigadier separates by position alone, with no keyword to name. Neither is
   addressed by anything, and a real case is what should decide the escape hatch.

---

## Saved commands

A `CommandDefinition` describes what a command _can_ be; a `SavedCommand`
(`src/schema/saved.ts`) is one someone kept. It is a separate, persisted format with
compatibility obligations the definition schema does not have, so its rules are
written down here rather than inferred from the type.

### It holds the value tree, not the text

The decision everything else inherits. Storing the rendered string is much simpler
and much worse: it cannot be resumed for editing, cannot be migrated across a version
bump, and would make command import the only route back into the editor. The tree is
the source of truth.

`preview` holds the text anyway, as an explicit **cache**. It exists so a list of
saved commands can show what each one is without loading the 560 KB of command
skeletons and 668 KB of registries that re-serializing needs. The tree wins wherever
the two disagree, and opening a command re-derives the text from it.

### The id is permanent

`id` is minted once, from `crypto.randomUUID()`, and never regenerated — not on
rename, not on re-save, not on reorder. A linked Konnekt preset stores
`{ source: 'kommands', id, revision }` pointing at it, so a changing id breaks every
link silently: nothing errors, and the user's only symptom is that edits stop
propagating. `createSaved` is the only function that writes the field.

### `revision` tracks content, not the record

It increments when the command's **content** changes, so a consumer can tell "I have
already seen this" from "this changed" without diffing the tree.

A rename deliberately does _not_ bump it. `revision` means "what this command emits
has changed", and a rename emits byte-identical text — bumping it would tell every
linked consumer to re-read a command that did not change. `updatedAt` moves on both.

### Version awareness is a trait comparison

A value tree is only meaningful against the version it was authored for, so a saved
command stores its version id. That id is never compared as a _number_:
`resumability()` resolves it through `src/data/versions/` and compares that version's
**traits** against the active one's.

| Answer            | Means                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `ready`           | The traits match, so the tree serializes the way it did when saved                                |
| `retraited`       | A known version that writes something differently — needs a migration decision, not a silent open |
| `unknown-version` | Nothing this build knows, so there are no traits to compare and no honest claim to make           |

Traits rather than numbers for the same reason serializers branch on them (§ Invariants,
rule 3): the changes did not land together, so no ordering of version numbers describes
them. Two versions with identical traits render a tree identically whatever their
numbers say.

Registry drift is deliberately not part of that answer. A resumed tree can hold an id
the active version does not have — 1.21.1's `generic.armor` against 1.21.5's `armor` —
and the existing validators already warn about exactly that. Refusing to open the
command would be this layer overruling rule 4 from a position where it cannot see
which value is wrong.

### Restoring a tree restores its instance counter

Repeat instance ids are handed out as `i0`, `i1`, … from a counter that resets with
the tree. Loading a saved tree without restoring that counter starts a session at `i0`
while the tree already holds one, putting two instances on one path — the failure the
generated-id model exists to prevent (§ Paths). `nextInstanceIdFor()` reads the counter
back off the tree, and `useCommandStore.load()` is the only sanctioned way in.

### Where it is stored

`src/storage/` is an interface with one implementation and a second one coming. The
backend is chosen once, in `resolveStorage()`; a call site never branches on which one
it got. `localStorage` today; the standalone desktop build's JSON file — the same file
Konnekt reads — swaps in there and nowhere else.

Storage being unavailable is a **state, not an error**. A browser refusing site data
makes even reading `window.localStorage` throw, and a generator that still generates
is far more useful than a blank page.
