import { createRouter } from '@tanstack/react-router'
import { rootRoute } from './routes/root'
import { indexRoute } from './routes/index'

// Routes are assembled here rather than generated from the filesystem. A file per
// command would reintroduce exactly the per-command cost docs/architecture.md
// § The constraint rules out: commands reach the UI as definitions resolved by one
// dynamic route, not as pages. See issue #6 for that route.
export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
