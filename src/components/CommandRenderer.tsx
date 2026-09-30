import { lazy, Suspense, useId } from 'react'
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
import type { CommandValue, ForcedSlot } from '../schema/serialize'
import {
  REF_ANY,
  type CommandDefinition,
  type Diagnostic,
  type Node,
  type UiMetadata,
} from '../schema/types'
import { ARG_LABEL, HELP, WARNING } from './editors/fieldStyles'
import { AnimatedHeight } from './ui/AnimatedHeight'
import { Segmented } from './ui/Segmented'
import { Switch } from './ui/Switch'
import {
  argumentPresentation,
  branchLabel,
  choiceControl,
  choiceLabel,
  NO_BRANCH_LABEL,
} from '../schema/presentation'
import { Listbox } from './ui/Listbox'
import type { ListOption } from '../lib/listbox'

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
  /**
   * The empty arguments the output had to write because a later one is set.
   *
   * Keyed by the same absolute paths inside an embedded command as outside it, which
   * is why a Ref can hand it on unchanged.
   */
  forced: ReadonlyMap<Path, ForcedSlot>
}

const DEFAULT_MAX_DEPTH = 8
const NOTHING_FORCED: ReadonlyMap<Path, ForcedSlot> = new Map()

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
  /**
   * Which empty arguments the output wrote anyway, from `serializeWithReport`.
   *
   * Handed in rather than computed here, because the workbench already serialized
   * this tree to show the output, and a second walk would be a second copy of the rule
   * that decides what a later argument forces.
   */
  forced?: ReadonlyMap<Path, ForcedSlot>
}

export function CommandRenderer({
  definition,
  value,
  ctx,
  actions,
  catalogue = {},
  maxDepth = DEFAULT_MAX_DEPTH,
  forced = NOTHING_FORCED,
}: CommandRendererProps) {
  return (
    <div className="arg-form flex flex-col">
      <NodeView
        node={definition.root}
        path={ROOT}
        value={value}
        ctx={ctx}
        actions={actions}
        scope={{ ui: definition.ui, catalogue, depth: maxDepth, forced }}
        literals={[]}
        nested={false}
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
  /**
   * The keywords above this node, outermost first: what a selector in `ui.arguments`
   * is matched against. `paths.ts`'s `walk` builds the same chain the same way.
   */
  literals: readonly string[]
  /** Inside a branch of some Choice, so its own branches are indented under it. */
  nested: boolean
  /** The node is a clause of a Repeat, drawn inside the chain editor's card. */
  inClause?: boolean
}

/** One row of the form: the name column and the control column. */
const ROW =
  'arg-row rounded-lg px-3 py-2 transition-colors duration-fast ease-standard hover:bg-hover motion-reduce:transition-none'

/** Where a Choice's nested branch sits: under it, on a hairline that says whose it is. */
const INDENT = 'border-l-hairline border-border-hover ml-3 pl-1'

function NodeView(props: NodeViewProps) {
  const { node, path, scope } = props
  switch (node.kind) {
    // A keyword is not something to fill in. It is in the output, in the branch picker
    // that chose it, and in nothing else: printed between fields, it read as a stray
    // label and pushed the fields after it along.
    case 'literal':
      return null

    case 'argument':
      return <ArgumentView {...props} node={node} ui={scope.ui} forced={scope.forced.get(path)} />

    case 'sequence':
      return <SequenceView {...props} node={node} />

    case 'choice':
      return <ChoiceView {...props} node={node} />

    case 'repeat':
      return <RepeatView {...props} node={node} />

    case 'flagset':
      return <FlagsView {...props} node={node} />

    case 'ref':
      return <RefView {...props} node={node} />
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
 * A sequence, as rows one under another.
 *
 * It used to be one wrapping line with the keywords printed between the fields, so a
 * choice that added a field re-wrapped everything after it and controls moved under
 * the pointer. A column never reflows sideways: a new field pushes the rows below it
 * down, and AnimatedHeight makes that a glide rather than a jump.
 */
function SequenceView(props: NodeViewProps & { node: Extract<Node, { kind: 'sequence' }> }) {
  const { node, path } = props
  const above = literalChains(node.nodes, props.literals)
  return (
    <div className="flex flex-col gap-0.5">
      {node.nodes.map((n, i) => (
        <NodeView key={i} {...props} node={n} path={child(path, i)} literals={above[i]!} />
      ))}
    </div>
  )
}

/** The keywords above each child of a sequence: the chain so far, plus every keyword before it. */
function literalChains(nodes: readonly Node[], start: readonly string[]): (readonly string[])[] {
  const chains: (readonly string[])[] = []
  let chain = start
  for (const n of nodes) {
    chains.push(chain)
    if (n.kind === 'literal') chain = [...chain, n.token]
  }
  return chains
}

/**
 * A Choice: a row that picks the branch, and the chosen branch's rows under it.
 *
 * A few short branches sit side by side as a segmented control, more go in a list (see
 * `choiceControl`). Switching branch swaps the rows below, and the space they take
 * glides to its new height instead of jumping, with the new rows fading in.
 */
function ChoiceView(props: NodeViewProps & { node: Extract<Node, { kind: 'choice' }> }) {
  const { node, path, value, actions, scope, literals, nested, inClause } = props
  const labelId = useId()
  const selected = choiceSelection(value.choices, path, node)
  const chosen = selected === NO_BRANCH ? undefined : node.nodes[selected]
  const options = branchOptions(node, scope.ui, literals)
  const pick = (next: string) => actions.setChoice(path, Number(next))

  return (
    <>
      <div className={ROW}>
        <div className="pt-1.5">
          <span id={labelId} className={ARG_LABEL}>
            {choiceLabel(node, inClause === true)}
          </span>
        </div>
        <div className="flex min-w-0 items-start">
          {choiceControl(options.map((o) => o.label)) === 'segmented' ? (
            <Segmented
              aria-labelledby={labelId}
              value={String(selected)}
              options={options}
              onChange={pick}
            />
          ) : (
            <Listbox
              aria-labelledby={labelId}
              value={String(selected)}
              options={options}
              onChange={pick}
              className="min-w-48"
            />
          )}
        </div>
      </div>
      <AnimatedHeight contentKey={String(selected)} className={nested && chosen ? INDENT : ''}>
        {chosen && (
          <NodeView
            {...props}
            node={chosen}
            path={branch(path, selected)}
            nested
            inClause={false}
          />
        )}
      </AnimatedHeight>
    </>
  )
}

function RepeatView(props: NodeViewProps & { node: Extract<Node, { kind: 'repeat' }> }) {
  const { node, path, value, actions, scope } = props
  // The rows this replaced were a documented placeholder: they proved the data
  // layer end to end and caught two bugs no unit test saw, and they were never the
  // design (#34). What survived the rewrite is everything that was not JSX - the id
  // list handed to `reorderRepeat`, the identity model under it, and the value tree
  // it permutes. The chain editor is a different *drawing* of the same three.
  const ids = repeatInstances(value.repeats, path, node)

  return (
    <div className="px-3 py-2">
      <Suspense fallback={<span className={HELP}>Loading the clause editor…</span>}>
        <ClauseChain
          ids={ids}
          min={node.min ?? 0}
          max={node.max}
          naming={(id) => clauseNaming(node.node, instance(path, id), value, scope.ui)}
          // The clause's own editors, rendered by this walk and handed over. The chain
          // draws the node around them and knows nothing about what is inside.
          renderClause={(id) => (
            <NodeView
              {...props}
              node={node.node}
              path={instance(path, id)}
              nested={false}
              inClause
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
    </div>
  )
}

function FlagsView({
  node,
  path,
  value,
  actions,
}: NodeViewProps & { node: Extract<Node, { kind: 'flagset' }> }) {
  const labelId = useId()
  return (
    <div className={ROW}>
      <div className="pt-1.5">
        <span id={labelId} className={ARG_LABEL}>
          Flags
        </span>
      </div>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-x-5 gap-y-2 pt-1.5">
        {node.flags.map((flag) => (
          <label key={flag.name} className="text-text-secondary flex items-center gap-2 text-xs">
            <Switch
              checked={value.flags[`${path}/${flag.name}`] ?? false}
              onChange={(on) => actions.setFlag(`${path}/${flag.name}`, on)}
            />
            {flag.label}
          </label>
        ))}
      </div>
    </div>
  )
}

/**
 * A command embedded in another — `/execute … run <command>`.
 *
 * The picker and the embedded form are one node, not two: choosing a command is the
 * only way the inner tree comes into existence, and the inner tree is rendered by the
 * same walk as the outer one. Nothing here knows which command was chosen.
 */
function RefView(props: NodeViewProps & { node: Extract<Node, { kind: 'ref' }> }) {
  const { node, path, value, actions, scope } = props
  const labelId = useId()
  const isAny = node.definitionId === REF_ANY
  const chosenId = isAny ? (value.refs[path] ?? '') : node.definitionId
  const target = scope.catalogue[chosenId]

  // The embedded command's own metadata, and one less depth to spend. Its values are
  // keyed below this Ref's path, so two embedded commands never collide.
  const inner: Scope = { ...scope, ui: target?.ui, depth: scope.depth - 1 }

  return (
    <>
      {isAny && (
        <div className={ROW}>
          <div className="pt-1.5">
            <span id={labelId} className={ARG_LABEL}>
              Command
            </span>
          </div>
          <div className="flex min-w-0 items-start">
            <Listbox
              aria-labelledby={labelId}
              value={chosenId}
              placeholder="choose a command"
              options={Object.values(scope.catalogue).map((d) => ({ value: d.id, label: d.label }))}
              onChange={(next) => actions.setRef(path, next)}
              className="min-w-48"
            />
          </div>
        </div>
      )}
      <AnimatedHeight contentKey={chosenId} className={target ? INDENT : ''}>
        {target && scope.depth > 0 && (
          <NodeView {...props} node={target.root} scope={inner} literals={[]} nested />
        )}
        {target && scope.depth <= 0 && (
          <span className={`${WARNING} px-3`}>
            This command embeds itself. The form stops here so the tab does not.
          </span>
        )}
      </AnimatedHeight>
    </>
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

  const derived = branchLabel(chosen, selected, ui)
  const authored = ui?.clauses?.[derived]
  return { label: authored?.label ?? derived, help: authored?.help }
}

/**
 * A Choice's branches as options, each value being the branch index.
 *
 * An optional clause can be left out entirely, so "none" is a real selection rather
 * than the absence of one. It leads because it is where a fresh command starts.
 */
function branchOptions(
  node: Extract<Node, { kind: 'choice' }>,
  ui: UiMetadata | undefined,
  literals: readonly string[],
): ListOption[] {
  const branches = node.nodes.map((n, i) => ({
    value: String(i),
    label: branchLabel(n, i, ui, literals),
  }))
  return node.optional
    ? [{ value: String(NO_BRANCH), label: NO_BRANCH_LABEL }, ...branches]
    : branches
}

interface ArgumentViewProps extends NodeViewProps {
  node: Extract<Node, { kind: 'argument' }>
  ui?: UiMetadata
  /** Set when the output wrote this argument although it is empty. */
  forced?: ForcedSlot
}

/**
 * One argument: its name and help in the first column, its editor in the second.
 *
 * The label points at its control by id rather than wrapping it. A wrapping label
 * labels only its first labelable descendant (a stepper's step-down button), and a
 * click anywhere inside it clicks that control too. An editor of several fields is a
 * fieldset the label names instead, and each of its fields names itself.
 *
 * Help and warnings reach the control as its description, so a field is announced as
 * "Recipients", then "Who receives the item.", rather than as one run-on name that
 * grows a warning as the user types.
 */
function ArgumentView({
  node,
  path,
  value,
  ctx,
  actions,
  ui,
  forced,
  literals,
}: ArgumentViewProps) {
  const type = lookupArgumentType(node.type)
  // The same options the serializer builds, so the field and the command agree about
  // what an untouched argument holds — including that an optional one holds nothing.
  const options = argumentOptions(node)
  const current = value.args[path] ?? type.defaultValue(options)
  const diagnostics: readonly Diagnostic[] = type.validate(current, options, ctx)
  const Editor = type.editor
  // The Brigadier name is the fallback, not the absence of a label. A derived
  // definition with no authored metadata still renders something addressable.
  const presentation = argumentPresentation(ui, node, literals)

  const controlId = useId()
  const labelId = useId()
  const helpId = useId()
  const notesId = useId()
  const hasNotes = forced !== undefined || diagnostics.length > 0
  const describedBy =
    [presentation?.help ? helpId : '', hasNotes ? notesId : ''].filter(Boolean).join(' ') ||
    undefined
  const group = type.labelling === 'group'
  const labelText = (
    <>
      {presentation?.label ?? node.name}
      {node.optional && <span className={OPTIONAL}>optional</span>}
    </>
  )
  const editor = (
    <Editor
      id={group ? undefined : controlId}
      describedBy={group ? undefined : describedBy}
      value={current}
      onChange={(next) => actions.setArg(path, next)}
      options={options}
      diagnostics={diagnostics}
      ctx={ctx}
    />
  )

  return (
    <div className={ROW}>
      <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
        {group ? (
          <span id={labelId} className={`${ARG_LABEL} flex items-center gap-1.5`}>
            {labelText}
          </span>
        ) : (
          <label
            id={labelId}
            htmlFor={controlId}
            className={`${ARG_LABEL} flex items-center gap-1.5`}
          >
            {labelText}
          </label>
        )}
        {presentation?.help && (
          <span id={helpId} className={HELP}>
            {presentation.help}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {group ? (
          <fieldset
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            className="w-full min-w-0"
          >
            {editor}
          </fieldset>
        ) : (
          editor
        )}
        {hasNotes && (
          <div id={notesId} className="flex flex-col gap-0.5">
            {/*
              Said beside the field rather than left for the output to explain, because
              the output only shows the result: a `0` nobody typed, or a `<seconds>` in
              a command that looked finished. The field is where the person can act.
            */}
            {forced?.how === 'default' && (
              <span
                className={HELP}
              >{`Written as ${forced.text} because a later value is set.`}</span>
            )}
            {forced?.how === 'placeholder' && (
              <span className={WARNING}>Needed because a later value is set.</span>
            )}
            {diagnostics.map((d, i) => (
              <span key={i} className={WARNING}>
                {d.message}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** The "optional" mark after an argument's name. A mark, so the muted step is enough. */
const OPTIONAL =
  'border-hairline border-border-hover text-text-muted rounded-pill px-1.5 text-1xs font-normal'
