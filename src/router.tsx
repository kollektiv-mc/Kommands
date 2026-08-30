import { createRouter } from '@tanstack/react-router'
import { rootRoute } from './routes/root'
import { indexRoute } from './routes/index'
import { editorRoute, editorIndexRoute } from './routes/commands'
import { commandRoute } from './routes/command'

// Routes are assembled here rather than generated from the filesystem. A file per
// command would reintroduce exactly the per-command cost docs/architecture.md
// § The constraint rules out: commands reach the UI as definitions resolved by one
// dynamic route, not as pages. `commandRoute` is that route — all 78 vanilla
// commands are reachable through it, and a 79th needs no entry here.
//
// It is nested under `editorRoute` rather than sitting beside it, so the editor frame
// and its navbar mount once for the whole `/c` subtree instead of once per selection.
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    editorRoute.addChildren([editorIndexRoute, commandRoute]),
  ]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
