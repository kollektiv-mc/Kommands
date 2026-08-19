import { useMemo } from 'react'
import type { SerializeContext, VersionDefinition } from '../data/versions/types'
import { CommandRenderer } from './CommandRenderer'
import { evaluateConstraints } from '../schema/constraints'
import { serializeCommand } from '../schema/serialize'
import type { CommandDefinition } from '../schema/types'
import { useCommandStore } from '../stores/useCommandStore'
import { LABEL, WARNING } from './editors/fieldStyles'

/**
 * A definition, its editors, and the command they produce.
 *
 * Like the renderer it knows nothing about which command it is showing. It exists so
 * the two halves — editing and output — share one value tree and re-render together.
 */
export function CommandWorkbench({
  definition,
  version,
}: {
  definition: CommandDefinition
  version: VersionDefinition
}) {
  const value = useCommandStore((s) => s.value)
  const setArg = useCommandStore((s) => s.setArg)
  const setFlag = useCommandStore((s) => s.setFlag)
  const setChoice = useCommandStore((s) => s.setChoice)
  const setRepeat = useCommandStore((s) => s.setRepeat)

  const ctx: SerializeContext = useMemo(
    () => ({ traits: version.traits, registries: { entries: () => [], has: () => true } }),
    [version],
  )

  const output = serializeCommand(definition, value, ctx)
  const warnings = evaluateConstraints(definition, value)

  return (
    <div className="flex flex-col gap-3">
      <CommandRenderer
        definition={definition}
        value={value}
        ctx={ctx}
        actions={{ setArg, setFlag, setChoice, setRepeat }}
      />

      <div className="border-hairline border-border-subtle bg-elevated rounded-panel flex flex-col gap-1 p-2">
        <span className={LABEL}>{`Output · ${version.id}`}</span>
        <code className="text-text-primary text-1xs font-mono break-all">
          {output || <span className="text-text-faint">nothing yet</span>}
        </code>
        {warnings.map((w, i) => (
          <span key={i} className={WARNING}>
            {w.message}
          </span>
        ))}
      </div>
    </div>
  )
}
