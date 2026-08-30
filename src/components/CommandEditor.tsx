import { useLayoutEffect } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { CommandWorkbench } from './CommandWorkbench'
import { SaveCommandBar } from './SaveCommandBar'
import { aliasNames } from '../schema/serialize'
import { v1_21_1 } from '../data/versions/1.21.1'
import { useCommandStore } from '../stores/useCommandStore'
import { useSavedCommandsStore } from '../stores/useSavedCommandsStore'

const route = getRouteApi('/c/$commandId')

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
  const saved = useSavedCommandsStore((s) =>
    savedId === undefined ? undefined : s.commands.find((c) => c.id === savedId),
  )

  // Before paint, so the workbench's first render is the saved command rather than an
  // empty one. `load` also restores the Repeat instance counter, which is why it is
  // an action rather than a plain assignment — see useCommandStore.load.
  //
  // Keyed on the saved command's *identity*, not its content: re-running on every
  // revision would overwrite what is being typed with what was last written.
  useLayoutEffect(() => {
    if (saved && saved.definitionId === commandId) loadValue(saved.value)
  }, [saved?.id, commandId, loadValue]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!definition) {
    return <p className="text-warning text-2xs">{`${commandId} is not a command in 1.21.1.`}</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
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
        footer={(output) => (
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
