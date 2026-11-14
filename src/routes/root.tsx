import { createRootRoute } from '@tanstack/react-router'

/**
 * The root renders nothing of its own, only its matched child.
 *
 * It used to draw the splash and the app's frame around every route, which was right
 * while every route was the app. The home page and the download page are not: they are
 * the web build's front door and carry their own header, so the frame moved down a
 * level into `appRoute` (routes/app.tsx), and the site's pages sit beside it here.
 */
export const rootRoute = createRootRoute()
