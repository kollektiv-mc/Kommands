import { createRoute } from '@tanstack/react-router'
import { editorRoute } from './commands'
import { CommandEditor } from '../components/CommandEditor'
import { loadRegistries } from '../data/loadGenerated'
import { loadCatalogue } from '../data/catalogue'
import { v1_21_1 } from '../data/versions/1.21.1'
import { useSavedCommandsStore } from '../stores/useSavedCommandsStore'

export const commandRoute = createRoute({
  getParentRoute: () => editorRoute,
  // One route for every command, rather than a file each. A page per command would
  // reintroduce exactly the per-command cost docs/architecture.md § The constraint
  // rules out — commands reach the UI as definitions resolved here.
  //
  // A child of the editor route, so its full path is still `/c/$commandId` while the
  // navbar above it stays mounted across every selection.
  path: '$commandId',
  /**
   * `?saved=<id>` names the saved command being edited.
   *
   * The id, not the tree. Putting the tree in the URL is a different feature with a
   * different mechanism (#43, permalinks) — this one says "you are editing that
   * record", which is what makes a reload resume it and every later save update it
   * rather than mint a second copy under a new id.
   */
  validateSearch: (search: Record<string, unknown>): { saved?: string } => ({
    saved: typeof search.saved === 'string' ? search.saved : undefined,
  }),
  loaderDeps: ({ search }) => ({ saved: search.saved }),
  // Fetched by the route rather than imported by the component, so neither
  // commands.json nor registries.json reaches the entry chunk. TanStack Router awaits
  // this before rendering, so the component never sees half-loaded data.
  loader: async ({ params, deps }) => {
    const [catalogue, registries] = await Promise.all([
      loadCatalogue(v1_21_1),
      loadRegistries(v1_21_1),
      // Awaited here rather than left to an effect so the editor's first paint already
      // has the saved tree in hand. Reading it afterwards would render the empty
      // command for one frame, and a resumed command flashing blank looks exactly like
      // one that failed to load.
      deps.saved === undefined ? undefined : useSavedCommandsStore.getState().load(),
    ])
    // The whole map travels on, not just the one definition: `/execute … run` embeds
    // any other command, so the picker needs the list and the serializer needs to
    // resolve what it picks. The map is already in hand — finding this definition
    // required loading it — so this costs a reference, not a fetch.
    return { definition: catalogue[params.commandId], catalogue, registries }
  },
  component: CommandEditor,
})
