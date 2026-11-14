import { Outlet } from '@tanstack/react-router'
import { AppShell } from './AppShell'
import { SplashScreen } from './SplashScreen'

/**
 * The splash and the frame around the app's routes.
 *
 * The splash sits beside the shell rather than inside it. It is a startup sequence,
 * not part of the frame: AppShell's own doc comment says the shell owns the frame and
 * routes own everything inside it, and an overlay that covers both is neither. It plays
 * each time the app opens: on a page load, and on the way in from the home page.
 */
export function AppLayout() {
  return (
    <>
      <SplashScreen />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  )
}
