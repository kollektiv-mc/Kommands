import { Outlet, getRouteApi, useParams, useSearch } from '@tanstack/react-router'
import { EditorLayout } from './EditorLayout'

const route = getRouteApi('/c')

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
 * its state across every selection. It is also what makes the entrance animation right:
 * `EditorLayout` runs the FLIP on mount, which now means once per *entering the editor*
 * rather than once per command clicked.
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

  return (
    <EditorLayout catalogue={catalogue} activeId={commandId} originKey={saved}>
      <Outlet />
    </EditorLayout>
  )
}
