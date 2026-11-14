import { createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { rootRoute } from './root'
import { probedBackend } from '../storage/probe'

/**
 * The installed app skips the site and opens on the dashboard.
 *
 * Both of the local install's surfaces, the window and the `--serve` browser session,
 * found a local backend before the first render (main.tsx), and neither has a use for a
 * page whose job is to offer the download that is already running. So this asks the
 * same question `resolveStorage` does, "is this the local install?", rather than
 * whether a window is drawn: `--serve` has no window chrome and is still the install.
 */
export function skipOnInstall() {
  if (probedBackend() !== null) throw redirect({ to: '/dashboard', replace: true })
}

/**
 * The home page: the web build's `/`. See docs/home-page.md for what it is.
 *
 * Fetched on first use, so the dashboard's page load does not carry it and it does not
 * carry the dashboard. `pnpm check-bundle` holds the entry chunk to that.
 */
export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: skipOnInstall,
  component: lazyRouteComponent(() => import('../components/home/HomePage'), 'HomePage'),
})

/** The page the standalone app is downloaded from. */
export const downloadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/download',
  beforeLoad: skipOnInstall,
  component: lazyRouteComponent(() => import('../components/home/DownloadPage'), 'DownloadPage'),
})
