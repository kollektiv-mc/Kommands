import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { AppLayout } from '../components/AppLayout'

/**
 * The app: the dashboard, the editor over it, and the frame around both.
 *
 * **Pathless**, like `dashboardRoute` beneath it, so no URL under it moved when it was
 * introduced. Route ids did: every id below gained an `/app` prefix, which is why
 * `getRouteApi` calls read `/app/dashboard/c`.
 *
 * The splash and the shell are `AppLayout`'s.
 */
export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppLayout,
})
