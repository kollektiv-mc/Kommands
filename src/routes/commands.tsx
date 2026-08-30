import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './root'
import { EditorShell } from '../components/EditorShell'
import { loadCatalogue } from '../data/catalogue'
import { v1_21_1 } from '../data/versions/1.21.1'
import { LABEL } from '../components/editors/fieldStyles'

/**
 * The editor, as a layout route.
 *
 * A parent rather than a sibling of `/c/$commandId`, so the navbar it renders is
 * mounted once for the whole subtree — see `EditorShell` for what that fixes.
 *
 * It loads the catalogue and *not* the registries. The navbar needs labels, aliases
 * and dialects, all of which are in the skeletons; registries are what an editor needs,
 * and at this level nothing is being edited yet. The child route loads them, so
 * arriving at `/c` never pays for the 668 KB an editor would.
 */
export const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/c',
  loader: () => loadCatalogue(v1_21_1),
  component: EditorShell,
})

/**
 * The editor with nothing selected — where "new command" lands.
 *
 * A route rather than a redirect into some arbitrary default command. Picking one for
 * the user would be a claim that it is the place to start, and there is no such
 * command: the catalogue is eighty-odd peers.
 */
export const editorIndexRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: '/',
  component: () => <p className={LABEL}>Pick a command from the list to start building one.</p>,
})
