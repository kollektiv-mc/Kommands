import { Outlet, getRouteApi, useParams, useSearch } from '@tanstack/react-router'
import { CommandOverlay } from './CommandOverlay'
import { EditorLayout } from './EditorLayout'

// `/dashboard/c`, not `/c`. The URL is still `/c` — what changed is the route *id*,
// because the pathless `dashboard` layout route sits between this and the root, and an
// id is a path through the route tree rather than through the URL. Worth stating: the
// two look interchangeable right up until one of them silently is not.
const route = getRouteApi('/dashboard/c')

/**
 * The frame every editor route renders inside.
 *
 * It exists because the alternative did not work. The editor's two routes — one with a
 * command selected and one without — were siblings at first, each rendering its own
 * `EditorLayout`, so moving between them unmounted the whole left-hand side and mounted
 * a fresh one. The filter someone had typed went with it: type "give", click the
 * result, and the list is back to all seventy-nine.
 *
 * As a parent route this renders once for the whole `/c` subtree, so the navbar keeps
 * its state across every selection — and the overlay opens and closes once per visit to
 * the editor rather than once per command clicked inside it.
 *
 * `useParams({ strict: false })` because this route has no `commandId` of its own — the
 * child that does may or may not be mounted, and strict params would be a type error
 * for the half of the subtree where there is none.
 */
export function EditorShell() {
  const catalogue = route.useLoaderData()
  const { commandId } = useParams({ strict: false })
  // `strict: false` for the same reason as the params: `saved` belongs to the child
  // route, which is not mounted on the editor's own index.
  const { saved } = useSearch({ strict: false })

  // Read from the catalogue already in hand rather than threaded up from the child,
  // which may not be mounted. Naming the dialog after the command is the difference
  // between a screen reader announcing "Command editor" and "/give".
  const label = commandId === undefined ? undefined : catalogue[commandId]?.label

  return (
    <CommandOverlay originKey={saved} label={label}>
      <EditorLayout catalogue={catalogue} activeId={commandId}>
        <Outlet />
      </EditorLayout>
    </CommandOverlay>
  )
}
