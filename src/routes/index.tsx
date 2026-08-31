import { createRoute } from '@tanstack/react-router'
import { dashboardRoute } from './dashboard'

/**
 * The dashboard's own route, which renders **nothing**.
 *
 * Not a mistake and not a placeholder. `dashboardRoute` draws the dashboard and then an
 * Outlet for whatever covers it; at `/` nothing covers it, so the correct content for
 * this route is empty. The page you see at `/` is its parent.
 *
 * Still no loader, and now for a stronger reason than before: the dashboard renders on
 * every route, so anything loaded here would be loaded on the way to the editor too.
 * Tiles draw from the `preview` string cached on each saved command, which is why
 * neither the 560 KB of command skeletons nor the 668 KB of registries is reachable
 * from this screen.
 */
export const indexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  component: () => null,
})
