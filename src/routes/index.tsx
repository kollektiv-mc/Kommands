import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'

// The component is inline, matching root.tsx: a route file that exported both a
// component and its route object would trip react-refresh/only-export-components.
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <section className="border-hairline border-border-subtle bg-surface rounded-panel max-w-2xl p-3">
      <h1 className="font-title mb-1 text-sm">Command generator</h1>
      <p className="text-text-secondary text-1xs leading-relaxed">
        Build commands through a UI instead of memorising syntax. Commands are declarative
        definitions rendered by a generic renderer, so adding one is a data change.
      </p>
    </section>
  ),
})
