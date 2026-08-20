import { createRoute, Link } from '@tanstack/react-router'
import { rootRoute } from './root'
import { catalogueList, loadCatalogue } from '../data/catalogue'
import { v1_21_1 } from '../data/versions/1.21.1'

// The component is inline, matching root.tsx: a route file that exported both a
// component and its route object would trip react-refresh/only-export-components.
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // Only the skeletons. The registries are three times the size and nothing on this
  // page reads them, so they load when a command does.
  loader: async () => {
    return { commands: catalogueList(await loadCatalogue(v1_21_1)) }
  },
  component: () => {
    const { commands } = indexRoute.useLoaderData()
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <section className="border-hairline border-border-subtle bg-surface rounded-panel p-3">
          <h1 className="font-title mb-1 text-sm">Command generator</h1>
          <p className="text-text-secondary text-1xs leading-relaxed">
            {`${commands.length} commands. The vanilla ones are derived from the Brigadier tree — nobody wrote those forms — and WorldEdit's are hand-written, because a plugin has no such tree to read. They arrive here as the same kind of thing, rendered by one generic renderer, so reaching the UI is a routing decision rather than a page.`}
          </p>
        </section>

        <ul className="flex flex-wrap gap-2">
          {commands.map((definition) => (
            <li key={definition.id}>
              <Link
                to="/c/$commandId"
                params={{ commandId: definition.id }}
                className="border-hairline border-border-subtle bg-elevated text-text-secondary text-1xs hover:border-border-hover hover:text-text-primary block rounded-md px-2 py-1 font-mono"
              >
                {definition.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  },
})
