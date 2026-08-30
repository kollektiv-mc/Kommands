import type { ReactNode } from 'react'
import { act, render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

/**
 * Render a component that contains a `<Link>` or calls `useNavigate`.
 *
 * Those need a router in context — without one `useLinkProps` reads `null` and throws
 * on `isServer`, which is a confusing way to be told a test is missing a provider.
 *
 * The router built here is a **stand-in with the real paths**, not the app's router.
 * Importing that would pull every route's loader, and with them `commands.json` and
 * `registries.json`, into the setup of tests that only wanted to click a link. What a
 * `<Link>` needs from a router is that its `to` resolves to a route, so the paths are
 * what has to match; the components behind them do not.
 *
 * Paths are duplicated from `src/router.tsx` and will drift if a route moves. That is
 * a deliberate trade against the import cost above, and it fails loudly rather than
 * quietly: an unresolvable `to` is a router error in the test that uses it.
 */
export async function renderWithRouter(ui: ReactNode, initialPath = '/') {
  const stub = () => <>{ui}</>
  const rootRoute = createRootRoute({ component: stub })
  const routes = [
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: stub }),
    createRoute({ getParentRoute: () => rootRoute, path: '/c', component: stub }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/c/$commandId',
      validateSearch: (search: Record<string, unknown>): { saved?: string } => ({
        saved: typeof search.saved === 'string' ? search.saved : undefined,
      }),
      component: stub,
    }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  // The cast is the price of the stand-in: `RouterProvider` is typed against the
  // registered router, and this one deliberately is not it. Everything under test
  // reads paths and search params, both of which this router really does provide.
  //
  // `load()` is awaited rather than assumed. A router resolves its initial match
  // asynchronously and `RouterProvider` renders nothing until it has — so without this
  // every assertion runs against an empty body, which reads as the component rendering
  // nothing rather than as the router not having started.
  const result = render(<RouterProvider router={router as never} />)
  await act(() => router.load())
  return { ...result, router }
}
