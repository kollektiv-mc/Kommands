/**
 * Whether this page load has shown the home or the download page.
 *
 * Module state rather than a store: it is set once, by the first site page to mount,
 * and read once, by the app layout as it mounts, and nothing renders from it. A reload
 * starts it over, which is the point: the splash belongs to a page load that opens on
 * the app, and a reload of `/dashboard` is one.
 */
let seen = false

export function markSiteSeen(): void {
  seen = true
}

export function cameFromSite(): boolean {
  return seen
}
