import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { CommandWorkbench } from '../components/CommandWorkbench'
import { loadCommands, loadRegistries } from '../data/loadGenerated'
import { withUi } from '../data/authored/ui'
import { v1_21_1 } from '../data/versions/1.21.1'

// The component is inline, matching root.tsx: a route file that exported both a
// component and its route object would trip react-refresh/only-export-components.
export const commandRoute = createRoute({
  getParentRoute: () => rootRoute,
  // One route for every command, rather than a file each. A page per command would
  // reintroduce exactly the per-command cost docs/architecture.md § The constraint
  // rules out — commands reach the UI as definitions resolved here.
  path: '/c/$commandId',
  // Fetched by the route rather than imported by the component, so neither
  // commands.json nor registries.json reaches the entry chunk. TanStack Router awaits
  // this before rendering, so the component never sees half-loaded data.
  loader: async ({ params }) => {
    const [commands, registries] = await Promise.all([
      loadCommands(v1_21_1),
      loadRegistries(v1_21_1),
    ])
    const derived = commands[params.commandId]
    return { definition: derived ? withUi(derived) : undefined, registries }
  },
  component: () => {
    const { definition, registries } = commandRoute.useLoaderData()
    const { commandId } = commandRoute.useParams()

    if (!definition) {
      return <p className="text-warning text-2xs">{`${commandId} is not a command in 1.21.1.`}</p>
    }

    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <section className="border-hairline border-border-subtle bg-surface rounded-panel p-3">
          <h1 className="font-title mb-1 text-sm">{definition.label}</h1>
          {definition.ui?.summary && (
            <p className="text-text-secondary text-1xs leading-relaxed">{definition.ui.summary}</p>
          )}
          {definition.aliases && definition.aliases.length > 0 && (
            <p className="text-text-muted text-2xs mt-1 font-mono">
              {`also /${definition.aliases.join(', /')}`}
            </p>
          )}
        </section>
        <CommandWorkbench definition={definition} version={v1_21_1} registries={registries} />
      </div>
    )
  },
})
