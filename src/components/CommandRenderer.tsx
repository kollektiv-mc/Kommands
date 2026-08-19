import type { SerializeContext } from '../data/versions/types'
import { lookupArgumentType } from '../schema/argument-types'
import { branch, child, instance, repeatCount, ROOT, type Path } from '../schema/paths'
import type { CommandValue } from '../schema/serialize'
import type { CommandDefinition, Diagnostic, Node } from '../schema/types'
import { LABEL, WARNING } from './editors/fieldStyles'

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
}

interface CommandRendererProps {
  definition: CommandDefinition
  value: CommandValue
  ctx: SerializeContext
  actions: Actions
}

export function CommandRenderer({ definition, value, ctx, actions }: CommandRendererProps) {
  return (
    <div className="flex flex-col gap-2">
      <NodeView node={definition.root} path={ROOT} value={value} ctx={ctx} actions={actions} />
    </div>
  )
}

interface NodeViewProps {
  node: Node
  path: Path
  value: CommandValue
  ctx: SerializeContext
  actions: Actions
}

function NodeView({ node, path, value, ctx, actions }: NodeViewProps) {
  switch (node.kind) {
    case 'literal':
      return <span className="text-text-muted text-1xs font-mono">{node.token}</span>

    case 'argument':
      return <ArgumentView node={node} path={path} value={value} ctx={ctx} actions={actions} />

    case 'sequence':
      return (
        <div className="flex flex-wrap items-end gap-2">
          {node.nodes.map((n, i) => (
            <NodeView
              key={i}
              node={n}
              path={child(path, i)}
              value={value}
              ctx={ctx}
              actions={actions}
            />
          ))}
        </div>
      )

    case 'choice': {
      const selected = value.choices[path] ?? 0
      const chosen = node.nodes[selected]
      return (
        <div className="flex items-end gap-2">
          <select
            className="border-hairline border-border-subtle bg-canvas text-text-primary text-1xs rounded-md px-2 py-1 font-mono"
            value={selected}
            aria-label="Clause"
            onChange={(e) => actions.setChoice(path, Number(e.target.value))}
          >
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
      // Rendering the referenced definition inline is #9's work; the picker needs the
      // definition registry, which arrives with the deriver. Until then this is
      // visible rather than silently absent.
      return <span className={LABEL}>embedded command</span>
  }
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
}

function ArgumentView({ node, path, value, ctx, actions }: ArgumentViewProps) {
  const type = lookupArgumentType(node.type)
  const options = node.typeOptions ?? {}
  const current = value.args[path] ?? type.defaultValue(options)
  const diagnostics: readonly Diagnostic[] = type.validate(current, options, ctx)
  const Editor = type.editor

  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>
        {node.name}
        {node.optional && <span className="text-text-faint"> optional</span>}
      </span>
      <Editor
        value={current}
        onChange={(next) => actions.setArg(path, next)}
        options={options}
        diagnostics={diagnostics}
        ctx={ctx}
      />
      {diagnostics.map((d, i) => (
        <span key={i} className={WARNING}>
          {d.message}
        </span>
      ))}
    </label>
  )
}
