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
  name: string              // unique within the definition; referenced by constraints and previews
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
  validate: (value, options) => Diagnostic[] // warnings, never hard failures
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
| `we_mask`        | — (WorldEdit)                | Mask builder                        |
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

1. `name` is unique within a definition. Constraints and preview `inputs` resolve
   against it.
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
