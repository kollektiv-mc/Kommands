import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { Landing } from '../components/Landing'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // No loader. The placeholder reads nothing, and the previous one pulled every
  // command skeleton on first paint to render a list this page no longer shows.
  component: Landing,
})
