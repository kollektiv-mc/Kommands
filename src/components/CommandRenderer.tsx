import { lazy, Suspense } from 'react'
import type { SerializeContext } from '../data/versions/types'
import { argumentOptions, lookupArgumentType } from '../schema/argument-types'
import {
  branch,
  child,
  choiceSelection,
  instance,
  NO_BRANCH,
  repeatInstances,
  ROOT,
  type InstanceId,
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
 * The chain editor for a Repeat, fetched on first use.
 *
 * Lazy for the reason `docs/health-checklist.md` § Open backlog gave before this was
 * written: the entry chunk measured 116.7 KB against a 120 KB budget, and the next UI
 * feature of this size needed either a lazy boundary or a considered budget raise.
 * It is also right on its own terms. A Repeat appears in a minority of definitions, so
 * `/give` has no reason to carry `/execute`'s editor.
 *
 * The clause bodies are passed *in* as a render prop rather than imported there, so
 * `ClauseChain` never reaches back into this module. A cycle here would be the kind
 * that resolves at build time and breaks under `React.lazy`.
 */
const ClauseChain = lazy(() => import('./editors/ClauseChain'))

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
  addInstance: (path: Path, node: { min?: number; max?: number }) => void
  reorderRepeat: (path: Path, ids: readonly InstanceId[], tag?: string) => void
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
            {node.optional && <option value={NO_BRANCH}>(none)</option>}
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
      // The rows this replaced were a documented placeholder: they proved the data
      // layer end to end and caught two bugs no unit test saw, and they were never the
      // design (#34). What survived the rewrite is everything that was not JSX - the id
      // list handed to `reorderRepeat`, the identity model under it, and the value tree
      // it permutes. The chain editor is a different *drawing* of the same three.
      const ids = repeatInstances(value.repeats, path, node)

      return (
        <Suspense
          fallback={<span className="text-text-faint text-2xs">Loading the clause editor…</span>}
        >
          <ClauseChain
            ids={ids}
            min={node.min ?? 0}
            max={node.max}
            naming={(id) => clauseNaming(node.node, instance(path, id), value, scope.ui)}
            // The clause's own editors, rendered by this walk and handed over. The chain
            // draws the node around them and knows nothing about what is inside.
            renderClause={(id) => (
              <NodeView
                node={node.node}
                path={instance(path, id)}
                value={value}
                ctx={ctx}
                actions={actions}
                scope={scope}
              />
            )}
            // Moving and removing are one action, because to a path-keyed tree they are
            // one operation: a new ordering, with removal the case where an id is left
            // out. Saying so once is what keeps a removed clause's values from coming
            // back in the next one added.
            //
            // The chain's gesture tag is qualified with this Repeat's path before it
            // reaches the store. The chain mints it from a counter of its own, so two
            // chains on one page would otherwise both call their first drag `drag:1`
            // and the second would coalesce into the first one's undo step.
            onReorder={(next, gesture) =>
              actions.reorderRepeat(
                path,
                next,
                gesture === undefined ? undefined : `${path}:${gesture}`,
              )
            }
            onAdd={() => actions.addInstance(path, node)}
          />
        </Suspense>
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

/**
 * What a clause in a chain is called, and what it does.
 *
 * A clause is a Choice branch rather than an argument, so `UiMetadata.arguments` has
 * no key for it and `ui.clauses` exists for exactly this. The authored entry is keyed
 * by the branch's leading literal - the command's own word for it - so a definition
 * regenerated from mcmeta with a branch inserted does not repoint every entry after it.
 *
 * Falls back to the derived name, which is the leading literal itself. That labels a
 * node adequately and explains nothing, which is the gap `help` fills: `anchored` is
 * what the command calls it, not what it means.
 *
 * A Repeat of something other than a Choice has no branch to read, and `/execute`'s is
 * the only Repeat in the catalogue today. It gets a neutral name rather than a guess.
 */
function clauseNaming(
  node: Node,
  path: Path,
  value: CommandValue,
  ui?: UiMetadata,
): { label: string; help?: string } {
  if (node.kind !== 'choice') return { label: 'clause' }

  const selected = choiceSelection(value.choices, path, node)
  const chosen = selected === NO_BRANCH ? undefined : node.nodes[selected]
  // An optional Choice starts with nothing applied, and that is a state rather than an
  // error: the clause exists and has not been told what to be yet.
  if (chosen === undefined) return { label: 'not set' }

  const derived = branchLabel(chosen, selected)
  const authored = ui?.clauses?.[derived]
  return { label: authored?.label ?? derived, help: authored?.help }
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
