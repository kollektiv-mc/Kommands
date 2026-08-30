import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { Dashboard } from '../components/Dashboard'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // Still no loader. The dashboard reads saved commands from storage through their
  // store, and draws each tile from the `preview` string saved alongside the tree —
  // so the app's first screen pulls neither the 560 KB of command skeletons nor the
  // 668 KB of registries. That is what the cached projection is for.
  component: () => (
    <div className="h-full overflow-auto p-3">
      <Dashboard />
    </div>
  ),
})
