import type { SerializeContext } from '../data/versions/types'
import { argumentOptions, lookupArgumentType } from '../schema/argument-types'
import {
  branch,
  child,
  choiceSelection,
  instance,
  NO_BRANCH,
  repeatCount,
  ROOT,
  type Path,
} from '../schema/paths'
import type { CommandValue } from '../schema/serialize'
import {
  REF_ANY,
  type CommandDefinition,
  type Diagnostic,
  type Node,
  type UiMetadata,
} from '../schema/types'
import { FIELD, LABEL, WARNING } from './editors/fieldStyles'

/**
 * Renders a command definition.
 *
 * This component **never** branches on a command id, and there is no place in it
 * where one could be checked: it is handed a definition and walks the node tree. If a
 * command seems to need custom logic here, the schema is missing something — extend
 * the schema or the argument-type registry, never this file.
 */

interface Actions {
  setArg: (path: Path, value: unknown) => void
  setFlag: (path: Path, on: boolean) => void
  setChoice: (path: Path, index: number) => void
  setRepeat: (path: Path, count: number) => void
  setRef: (path: Path, definitionId: string) => void
}

/** Every command a `@any` Ref may embed, by id. */
export type Catalogue = Readonly<Record<string, CommandDefinition>>

/**
 * What a subtree is rendered *against*, as opposed to the node itself.
 *
 * One object rather than three props because a Ref replaces all of it at once: inside
 * an embedded command the labels come from that command's metadata, not the outer
 * one's, and the budget that stops a cycle is one lower.
 */
interface Scope {
  /**
   * Authored presentation for the definition currently being walked.
   *
   * Threaded rather than looked up, so this component still knows nothing about which
   * command it is rendering — it is handed the labels along with the tree.
   */
  ui?: UiMetadata
  catalogue: Catalogue
  /**
   * How many more Refs may be entered.
   *
   * The mirror of the serializer's `maxDepth`, and there for the same reason:
   * command-schema.md forbids a Ref that reaches itself without passing a Repeat, but a
   * definition is data and data can be wrong. A cap turns a frozen tab into a form that
   * stops early.
   */
  depth: number
}

const DEFAULT_MAX_DEPTH = 8

interface CommandRendererProps {
  definition: CommandDefinition
  value: CommandValue
  ctx: SerializeContext
  actions: Actions
  /**
   * Commands reachable from a `@any` Ref. Empty when nothing embeds anything, which is
   * every command but /execute and /return.
   */
  catalogue?: Catalogue
  maxDepth?: number
}

export function CommandRenderer({
  definition,
  value,
  ctx,
  actions,
  catalogue = {},
  maxDepth = DEFAULT_MAX_DEPTH,
}: CommandRendererProps) {
  return (
    <div className="flex flex-col gap-2">
      <NodeView
        node={definition.root}
        path={ROOT}
        value={value}
        ctx={ctx}
        actions={actions}
        scope={{ ui: definition.ui, catalogue, depth: maxDepth }}
      />
    </div>
  )
}

interface NodeViewProps {
  node: Node
  path: Path
  value: CommandValue
  ctx: SerializeContext
  actions: Actions
  scope: Scope
}

function NodeView({ node, path, value, ctx, actions, scope }: NodeViewProps) {
  switch (node.kind) {
    case 'literal':
      // pt-4 clears the label above a sibling editor, so a keyword lines up with the
      // fields it introduces rather than with their labels.
      return <span className="text-text-muted text-1xs pt-4 font-mono">{node.token}</span>

    case 'argument':
      return (
        <ArgumentView
          node={node}
          path={path}
          value={value}
          ctx={ctx}
          actions={actions}
          ui={scope.ui}
        />
      )

    case 'sequence':
      return (
        // Top-aligned, not bottom-aligned: a sequence mixes one-line editors with
        // deep ones that are many lines tall, and aligning on the bottom edge leaves
        // the short ones floating halfway down the row with nothing to line up with.
        <div className="flex flex-wrap items-start gap-2">
          {node.nodes.map((n, i) => (
            <NodeView
              key={i}
              node={n}
              path={child(path, i)}
              value={value}
              ctx={ctx}
              actions={actions}
              scope={scope}
            />
          ))}
        </div>
      )

    case 'choice': {
      const selected = choiceSelection(value.choices, path, node)
      const chosen = selected === NO_BRANCH ? undefined : node.nodes[selected]
      return (
        <div className="flex items-end gap-2">
          <select
            className={FIELD}
            value={selected}
            aria-label="Clause"
            onChange={(e) => actions.setChoice(path, Number(e.target.value))}
          >
            {/* An optional clause can be left out entirely, so "none" is a real
                selection rather than the absence of one. It leads because it is where
                a fresh command starts. */}
            {node.optional && <option value={NO_BRANCH}>— none —</option>}
            {node.nodes.map((n, i) => (
              <option key={i} value={i}>
                {branchLabel(n, i)}
              </option>
            ))}
          </select>
          {chosen && (
            <NodeView
              node={chosen}
              path={branch(path, selected)}
              value={value}
              ctx={ctx}
              actions={actions}
              scope={scope}
            />
          )}
        </div>
      )
    }

    case 'repeat': {
      const count = repeatCount(value.repeats, path, node)
      return (
        <div className="border-l-hairline border-border-subtle flex flex-col gap-2 pl-2">
          {Array.from({ length: count }, (_, i) => (
            <NodeView
              key={i}
              node={node.node}
              path={instance(path, i)}
              value={value}
              ctx={ctx}
              actions={actions}
              scope={scope}
            />
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className="text-accent text-2xs"
              onClick={() => actions.setRepeat(path, count + 1)}
            >
              + add
            </button>
            {count > (node.min ?? 0) && (
              <button
                type="button"
                className="text-text-muted text-2xs"
                onClick={() => actions.setRepeat(path, count - 1)}
              >
                − remove
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'flagset':
      return (
        <div className="flex flex-wrap gap-2">
          {node.flags.map((flag) => (
            <label key={flag.name} className="flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-accent"
                checked={value.flags[`${path}/${flag.name}`] ?? false}
                onChange={(e) => actions.setFlag(`${path}/${flag.name}`, e.target.checked)}
              />
              <span className={LABEL}>{flag.label}</span>
            </label>
          ))}
        </div>
      )

    case 'ref':
      return (
        <RefView node={node} path={path} value={value} ctx={ctx} actions={actions} scope={scope} />
      )
  }

  // Unreachable while Node is exhausted above. It is here so that adding a node kind
  // is a compile error in this file too: without it the renderer is the one walk that
  // silently drops an unknown kind, showing a form that is quietly missing a field.
  return assertNever(node)
}

function assertNever(node: never): never {
  throw new Error(`CommandRenderer: unhandled node ${JSON.stringify(node)}`)
}

/**
 * A command embedded in another — `/execute … run <command>`.
 *
 * The picker and the embedded form are one node, not two: choosing a command is the
 * only way the inner tree comes into existence, and the inner tree is rendered by the
 * same walk as the outer one. Nothing here knows which command was chosen.
 */
function RefView({
  node,
  path,
  value,
  ctx,
  actions,
  scope,
}: NodeViewProps & { node: Extract<Node, { kind: 'ref' }> }) {
  const isAny = node.definitionId === REF_ANY
  const chosenId = isAny ? (value.refs[path] ?? '') : node.definitionId
  const target = scope.catalogue[chosenId]

  // The embedded command's own metadata, and one less depth to spend. Its values are
  // keyed below this Ref's path, so two embedded commands never collide.
  const inner: Scope = { ui: target?.ui, catalogue: scope.catalogue, depth: scope.depth - 1 }

  return (
    <div className="border-l-hairline border-border-subtle flex flex-col gap-2 pl-2">
      {isAny && (
        <label className="flex flex-col gap-1">
          <span className={LABEL}>command</span>
          <select
            className={FIELD}
            value={chosenId}
            onChange={(e) => actions.setRef(path, e.target.value)}
          >
            <option value="">choose a command</option>
            {Object.values(scope.catalogue).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {target && scope.depth > 0 && (
        <NodeView
          node={target.root}
          path={path}
          value={value}
          ctx={ctx}
          actions={actions}
          scope={inner}
        />
      )}
      {target && scope.depth <= 0 && (
        <span className={WARNING}>
          This command embeds itself. The form stops here so the tab does not.
        </span>
      )}
    </div>
  )
}

function branchLabel(node: Node, index: number): string {
  if (node.kind === 'literal') return node.token
  if (node.kind === 'sequence') {
    const first = node.nodes[0]
    if (first?.kind === 'literal') return first.token
  }
  return `option ${index + 1}`
}

interface ArgumentViewProps {
  node: Extract<Node, { kind: 'argument' }>
  path: Path
  value: CommandValue
  ctx: SerializeContext
  actions: Actions
  ui?: UiMetadata
}

function ArgumentView({ node, path, value, ctx, actions, ui }: ArgumentViewProps) {
  const type = lookupArgumentType(node.type)
  // The same options the serializer builds, so the field and the command agree about
  // what an untouched argument holds — including that an optional one holds nothing.
  const options = argumentOptions(node)
  const current = value.args[path] ?? type.defaultValue(options)
  const diagnostics: readonly Diagnostic[] = type.validate(current, options, ctx)
  const Editor = type.editor
  // The Brigadier name is the fallback, not the absence of a label. A derived
  // definition with no authored metadata still renders something addressable.
  const presentation = ui?.arguments?.[node.name]

  // Help and warnings sit outside the label, not inside it. A wrapping label
  // contributes all of its text to the accessible name of the control it wraps, so
  // help text inside one produces a field announced as "Recipients Who receives the
  // item." — and a warning would append itself to that as the user typed.
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>
          {presentation?.label ?? node.name}
          {node.optional && <span className="text-text-faint"> optional</span>}
        </span>
        <Editor
          value={current}
          onChange={(next) => actions.setArg(path, next)}
          options={options}
          diagnostics={diagnostics}
          ctx={ctx}
        />
      </label>
      {presentation?.help && <span className="text-text-faint text-3xs">{presentation.help}</span>}
      {diagnostics.map((d, i) => (
        <span key={i} className={WARNING}>
          {d.message}
        </span>
      ))}
    </div>
  )
}
