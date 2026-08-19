import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { CommandWorkbench } from '../components/CommandWorkbench'
import { loadCommands, loadRegistries } from '../data/loadGenerated'
import { v1_21_1 } from '../data/versions/1.21.1'

// The component is inline, matching root.tsx: a route file that exported both a
// component and its route object would trip react-refresh/only-export-components.
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // The skeleton is fetched by the route rather than imported by the component, so
  // commands.json stays out of the entry chunk. TanStack Router awaits this before
  // rendering, so the component never sees a half-loaded definition.
  loader: async () => {
    const [commands, registries] = await Promise.all([
      loadCommands(v1_21_1),
      loadRegistries(v1_21_1),
    ])
    return { give: commands['vanilla:give'], registries }
  },
  component: () => {
    const { give, registries } = indexRoute.useLoaderData()
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <section className="border-hairline border-border-subtle bg-surface rounded-panel p-3">
          <h1 className="font-title mb-1 text-sm">Command generator</h1>
          <p className="text-text-secondary text-1xs leading-relaxed">
            Commands are declarative definitions rendered by a generic renderer, so adding one is a
            data change. Below is /give as derived from the Brigadier tree — nobody wrote this form.
            Its item field is the raw_text fallback until the data-component editor lands.
          </p>
        </section>
        {give ? (
          <CommandWorkbench definition={give} version={v1_21_1} registries={registries} />
        ) : (
          <p className="text-warning text-2xs">/give is missing from the generated data.</p>
        )}
      </div>
    )
  },
})
