import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { CommandWorkbench } from '../components/CommandWorkbench'
import { GIVE } from '../schema/fixtures'
import { v1_21_1 } from '../data/versions/1.21.1'

// The component is inline, matching root.tsx: a route file that exported both a
// component and its route object would trip react-refresh/only-export-components.
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div className="flex max-w-2xl flex-col gap-3">
      <section className="border-hairline border-border-subtle bg-surface rounded-panel p-3">
        <h1 className="font-title mb-1 text-sm">Command generator</h1>
        <p className="text-text-secondary text-1xs leading-relaxed">
          Commands are declarative definitions rendered by a generic renderer, so adding one is a
          data change. Below is the /give definition from the schema docs, rendered by that renderer
          — it is hand-written until the deriver lands, and its item field is the raw_text fallback
          until the data-component editor does.
        </p>
      </section>
      <CommandWorkbench definition={GIVE} version={v1_21_1} />
    </div>
  ),
})
