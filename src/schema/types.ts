import type { SerializeContext } from '../data/versions/types'
import type { ComponentType } from 'react'

/**
 * The command definition schema. Authoritative spec: docs/command-schema.md.
 *
 * A command is data. The renderer walks this tree and never learns which command it
 * is rendering — if one appears to need custom component logic, the schema is missing
 * something, and the fix is to extend the schema rather than special-case the command.
 */

// ── Argument types ──────────────────────────────────────────────────────────

/**
 * A key into the argument-type registry.
 *
 * Deliberately a plain string rather than a closed union: the registry is extended by
 * registration, and a closed union here would mean every new type edits this file.
 * `isArgumentTypeKey` at the registry boundary is what turns an unknown key into an
 * error.
 */
export type ArgumentTypeKey = string

export interface Diagnostic {
  /** Always a warning. Validation never blocks output — the user decides. */
  severity: 'warning'
  message: string
}

export interface EditorProps<T = unknown> {
  value: T
  onChange: (next: T) => void
  options: Readonly<Record<string, unknown>>
  /** Warnings for this argument. Rendered alongside the editor, never instead of it. */
  diagnostics: readonly Diagnostic[]
  /**
   * Traits and registries for the target version.
   *
   * An editor that offers game values — an item picker, an enchantment list — must
   * read them from here rather than hold a list of its own, for the same reason a
   * serializer must: the values are versioned, and a component that knew them would
   * be wrong for every version but one. It is the same object the serializer is
   * handed, so it carries no version id to compare against either.
   */
  ctx: SerializeContext
}

export type ArgumentOptions = Readonly<Record<string, unknown>>

export interface ArgumentType<T = unknown> {
  key: ArgumentTypeKey
  editor: ComponentType<EditorProps<T>>
  /** Turns a value into command text. Reads traits from ctx; never a version number. */
  serialize: (value: T, ctx: SerializeContext) => string
  /** Returns warnings. Never throws, never blocks. Reads registries from ctx. */
  validate: (value: T, options: ArgumentOptions, ctx: SerializeContext) => Diagnostic[]
  defaultValue: (options: ArgumentOptions) => T
}

/**
 * An ArgumentType with its value parameter erased.
 *
 * The registry has to hold types over different value shapes in one map, and the
 * value tree really is `unknown` at runtime, so erasure is honest rather than a
 * workaround. TypeScript has no existential type to express "some T", which is why
 * this is a separate interface rather than `ArgumentType<unknown>` — the latter is
 * not a supertype, because `serialize` takes its value contravariantly.
 *
 * The safety given up is recovered by construction: a value for a key is only ever
 * produced by the editor and consumed by the serializer of the *same* entry, which
 * `defineArgumentType` pairs at the definition site. Consumers see `unknown` and need
 * no casts of their own.
 */
export interface ErasedArgumentType {
  key: ArgumentTypeKey
  editor: ComponentType<{
    value: unknown
    onChange: (next: unknown) => void
    options: ArgumentOptions
    diagnostics: readonly Diagnostic[]
    ctx: SerializeContext
  }>
  serialize: (value: unknown, ctx: SerializeContext) => string
  validate: (value: unknown, options: ArgumentOptions, ctx: SerializeContext) => Diagnostic[]
  defaultValue: (options: ArgumentOptions) => unknown
}

// ── Nodes ───────────────────────────────────────────────────────────────────

/** A fixed token: the command name, or a subcommand keyword. */
export interface LiteralNode {
  kind: 'literal'
  token: string
}

/** A user-supplied value. */
export interface ArgumentNode {
  kind: 'argument'
  /** Unique within the definition. Constraints and preview inputs resolve against it. */
  name: string
  type: ArgumentTypeKey
  /** Passed to the editor and the validator, e.g. { min: 1 }. */
  typeOptions?: Readonly<Record<string, unknown>>
  /** Derived from Brigadier `executable` flags. */
  optional?: boolean
  /** Consumes all remaining tokens, joined with spaces. */
  variadic?: boolean
  default?: unknown
}

/** Ordered children. All non-optional children must be satisfied. */
export interface SequenceNode {
  kind: 'sequence'
  nodes: Node[]
}

/** Exactly one child applies — the /execute subcommand alternatives. */
export interface ChoiceNode {
  kind: 'choice'
  nodes: Node[]
}

/** Child may appear multiple times. This is how Brigadier `redirect` is represented. */
export interface RepeatNode {
  kind: 'repeat'
  node: Node
  min?: number
  max?: number
}

export interface Flag {
  /** Referenced by constraints as '-h'. */
  name: string
  /** 'h'. */
  char: string
  label: string
}

/** Boolean switches. WorldEdit only; serialised as one combined token (-hro). */
export interface FlagSetNode {
  kind: 'flagset'
  flags: Flag[]
}

/** Any command in the same dialect and version. The renderer offers a picker. */
export const REF_ANY = '@any'

/** Embeds another command definition. This is /execute … run <command>. */
export interface RefNode {
  kind: 'ref'
  definitionId: string | typeof REF_ANY
}

export type Node =
  LiteralNode | ArgumentNode | SequenceNode | ChoiceNode | RepeatNode | FlagSetNode | RefNode

// ── Constraints ─────────────────────────────────────────────────────────────

export interface Constraint {
  kind: 'mutex' | 'requires' | 'range'
  /** Argument or flag names. */
  targets: string[]
  /** Shown to the user when violated. Constraints warn; they never block. */
  message: string
}

// ── Definitions ─────────────────────────────────────────────────────────────

export interface VersionRange {
  min: string
  max?: string
}

export interface PreviewBinding {
  module: string
  /** Argument or flag names. Validated at build time against the definition. */
  inputs: string[]
}

export interface UiMetadata {
  summary?: string
  /** Per-argument presentation. Derivation cannot produce these. */
  arguments?: Record<string, { label?: string; help?: string; group?: string }>
}

export interface CommandDefinition {
  /** Stable unique key: '<dialect>:<name>'. Used for routing and Ref nodes. */
  id: string
  /** Display name, e.g. '/give'. */
  label: string
  dialect: 'vanilla' | 'worldedit'
  /** 'derived' files are overwritten by pnpm gen:commands. Never hand-edit them. */
  provenance: 'derived' | 'authored'
  versions: VersionRange
  aliases?: string[]
  root: Node
  /** Cross-argument rules the tree shape cannot express. */
  constraints?: Constraint[]
  preview?: PreviewBinding
  /** Presentation metadata. Always authored. */
  ui?: UiMetadata
}
