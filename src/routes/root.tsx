import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'
import { SplashScreen } from '../components/SplashScreen'

// The splash sits beside the shell rather than inside it. It is a startup sequence,
// not part of the frame — AppShell's own doc comment says the shell owns the frame and
// routes own everything inside it, and an overlay that covers both is neither.
export const rootRoute = createRootRoute({
  component: () => (
    <>
      <SplashScreen />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  ),
})
