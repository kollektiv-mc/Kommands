import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { AppShell } from './AppShell'
import { SplashScreen } from './SplashScreen'
import { cameFromSite } from '../lib/siteEntry'

/**
 * The splash and the frame around the app's routes.
 *
 * The splash sits beside the shell rather than inside it. It is a startup sequence,
 * not part of the frame: AppShell's own doc comment says the shell owns the frame and
 * routes own everything inside it, and an overlay that covers both is neither. It plays
 * when the app is what a page load opens on, and not when the home page led here, which
 * has already shown the mark and would otherwise show it a second time on the way in.
 */
export function AppLayout() {
  const [splash] = useState(() => !cameFromSite())
  return (
    <>
      {splash && <SplashScreen />}
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  )
}
