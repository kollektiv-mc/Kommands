import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'

export const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
