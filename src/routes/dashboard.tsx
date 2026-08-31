import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { DashboardLayout } from '../components/DashboardLayout'

/**
 * The layer the dashboard lives on, and everything else renders over.
 *
 * **Pathless** — it has an `id` and no `path`, so every route beneath it keeps the URL
 * it had. `/`, `/c` and `/c/$commandId` are unchanged, which is why `src/test-router.tsx`
 * needs no edit and why no `<Link to=…>` moves. A layout route is the mechanism for
 * "render this behind those" without inventing a path to hang it on.
 *
 * Route **ids** are a different matter and do move: an id is a path through the route
 * tree, not through the URL, so `getRouteApi('/c')` became `getRouteApi('/dashboard/c')`
 * and `'/c/$commandId'` became `'/dashboard/c/$commandId'`. The two look interchangeable
 * right up until one of them silently is not.
 *
 * It exists because the editor stopped replacing the dashboard and started covering
 * it. Two routes cannot both be mounted as siblings; a parent and a child can. The
 * dashboard is the page, and the editor is a thing on top of it.
 *
 * Not folded into `rootRoute`, which owns the *frame* — the splash and the shell.
 * root.tsx already draws that line for the splash ("the shell owns the frame and
 * routes own everything inside it"), and a dashboard in the root would break it one
 * level down: every future route that is not the editor — a settings page, a
 * not-found — would render the dashboard behind it whether or not that made sense.
 */
export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  component: DashboardLayout,
})
