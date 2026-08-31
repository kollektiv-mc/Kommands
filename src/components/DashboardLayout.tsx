import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { Dashboard } from './Dashboard'

/**
 * The dashboard, and whatever is currently covering it.
 *
 * The dashboard stays mounted while the editor is open — which is the whole point of
 * the overlay, and buys three things that the previous navigate-away arrangement could
 * not. The editor appears to grow out of the tile that opened it and shrink back into
 * it, because the tile is still there to measure. Closing is instant, because nothing
 * has to be re-fetched or re-rendered from scratch. And the dashboard behind the dim
 * gives the editor somewhere to be *on top of*, which is what makes it read as a panel
 * rather than as a page.
 *
 * The cost is that the dashboard now mounts on every route, including a cold link
 * straight to `/c/vanilla:give`. That is one `localStorage` read — the editor's
 * `?saved=` loader would have paid for it anyway — and it means a permalink visitor
 * lands with the empty-state hero behind the dim and finds it there on Escape. That is
 * a coherent place to be left rather than a bug, but it is a deliberate choice and not
 * an accident of nesting.
 */
export function DashboardLayout() {
  const matchRoute = useMatchRoute()
  // `fuzzy` so `/c` and `/c/$commandId` both count. The question is "is anything
  // covering the dashboard", not "which thing".
  const covered = matchRoute({ to: '/c', fuzzy: true }) !== false

  return (
    <div className="relative h-full">
      {/*
        `inert` rather than a focus trap. React 19 passes it through, and the platform
        then removes the whole subtree from the tab order, from the pointer, and from
        the accessibility tree — the three things a hand-rolled trap tries to do and
        usually gets two of. It costs no bytes and no JS.

        The overflow swap is the scroll lock. It also keeps the captured tile rect
        valid: a dashboard that could scroll under the overlay would leave the exit
        animation collapsing to where the tile no longer is.
      */}
      <div
        inert={covered}
        className={`h-full p-3 ${covered ? 'overflow-hidden' : 'overflow-auto'}`}
      >
        <Dashboard />
      </div>
      <Outlet />
    </div>
  )
}
