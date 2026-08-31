import { useEffect, useLayoutEffect } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { CommandWorkbench } from './CommandWorkbench'
import { SaveCommandBar } from './SaveCommandBar'
import { aliasNames } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'
import { canResume, structureState } from '../schema/saved'
import { useCommandStore } from '../stores/useCommandStore'
import { useSavedCommandsStore } from '../stores/useSavedCommandsStore'
import { WARNING } from './editors/fieldStyles'

const route = getRouteApi('/dashboard/c/$commandId')

/**
 * Why a saved tree was not restored. Three refusals, three different explanations —
 * "the command is gone", "the command was reshaped" and "this predates the check" are
 * the same outcome for very different reasons, and a user can act on the difference.
 */
const REFUSAL = {
  verified: null,
  stale:
    'Saved against an older shape of this command, so it opens empty. The text below is what it produced.',
  'unknown-command':
    'The command this was built for is not in this build. The text below is what it produced.',
  unverified:
    'Saved before Kommands recorded command shapes, so it cannot be verified and opens empty.',
} as const

/**
 * The editor for one command.
 *
 * In its own file, unlike the other routes' inline arrows, because it is the only one
 * that calls hooks — and the two lint rules that govern that leave no third option. An
 * arrow assigned to `component:` is, as far as `react-hooks/rules-of-hooks` can see, an
 * ordinary function calling `useState`, because the rule identifies a component by its
 * name. Naming it satisfies that rule and immediately trips
 * `react-refresh/only-export-components`, since the route file also exports a route
 * object. A separate file is what satisfies both.
 *
 * It reaches its route through `getRouteApi` rather than by importing `commandRoute`,
 * which would be a cycle: the route imports this component. The route id is a string
 * here and a typed one — the registered router is what makes `'/c/$commandId'`
 * resolve to this route's loader data rather than to `unknown`.
 */
export function CommandEditor() {
  const { definition, catalogue, registries } = route.useLoaderData()
  const { commandId } = route.useParams()
  const { saved: savedId } = route.useSearch()

  const value = useCommandStore((s) => s.value)
  const loadValue = useCommandStore((s) => s.load)
  const reset = useCommandStore((s) => s.reset)
  const markOpened = useSavedCommandsStore((s) => s.markOpened)
  const saved = useSavedCommandsStore((s) =>
    savedId === undefined ? undefined : s.commands.find((c) => c.id === savedId),
  )

  // Whether the definition still has the shape this tree was built against. The tile
  // could not answer this — the dashboard has no catalogue — so the refusal lands here,
  // at the moment of opening, which is where persistence.md wants it.
  const structure = saved ? structureState(saved, definition) : 'verified'
  const resumes = canResume(structure)

  // Before paint, so the workbench's first render is the saved command rather than an
  // empty one. `load` also restores the Repeat instance counter, which is why it is
  // an action rather than a plain assignment — see useCommandStore.load.
  //
  // Keyed on the saved command's *identity*, not its content: re-running on every
  // revision would overwrite what is being typed with what was last written.
  //
  // The `else reset()` is not belt-and-braces. Open a stale save for the definition you
  // were just editing and, without it, the store still holds the previous tree — which
  // reads exactly like a partial restore, the one outcome persistence.md forbids. It is
  // also what makes "no value from the stale tree reaches the workbench" assertable
  // rather than true by luck.
  useLayoutEffect(() => {
    if (!saved || saved.definitionId !== commandId) return
    if (resumes) loadValue(saved.value)
    else reset()
  }, [saved?.id, commandId, resumes, loadValue, reset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recorded on open, which is what the Recent panel orders by. Passive metadata: it
  // moves neither `revision` nor `updatedAt`, so it cannot reorder the Saved panel.
  useEffect(() => {
    if (saved) void markOpened(saved.id)
  }, [saved?.id, markOpened]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!definition) {
    return <p className="text-warning text-2xs">{`${commandId} is not a command in 1.21.1.`}</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {saved && !resumes && (
        <section className="border-hairline border-border-hover bg-surface rounded-panel flex flex-col gap-1 p-3">
          <span className={WARNING}>{REFUSAL[structure]}</span>
          {/*
            The degraded state persistence.md describes: still readable, still copyable,
            still sendable to Konnekt. What is not offered is a way to load the tree
            anyway — that is the partial restore, wearing a button.
          */}
          <code className="text-text-secondary text-1xs font-mono break-all">{saved.preview}</code>
        </section>
      )}
      <section className="border-hairline border-border-subtle bg-surface rounded-panel flex flex-col gap-1 p-3">
        <h1 className="font-title text-sm">{definition.label}</h1>
        {definition.ui?.summary && (
          <p className="text-text-secondary text-1xs leading-relaxed">{definition.ui.summary}</p>
        )}
        {definition.aliases && definition.aliases.length > 0 && (
          <p className="text-text-muted text-2xs font-mono">
            {`also ${aliasNames(definition).join(', ')}`}
          </p>
        )}
      </section>
      <CommandWorkbench
        definition={definition}
        version={v1_21_1}
        registries={registries}
        catalogue={catalogue}
        actions={(output) => (
          <SaveCommandBar
            definition={definition}
            version={v1_21_1}
            value={value}
            output={output}
            savedId={saved?.id}
          />
        )}
      />
    </div>
  )
}
