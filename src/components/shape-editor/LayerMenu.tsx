import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { find } from '../../worldedit/stack/edit'
import { ContextMenu, type MenuAction } from './ContextMenu'

/** A layer's menu, from its row in the list or from the layer in the view. */
export function LayerMenu({
  id,
  at,
  onClose,
}: {
  id: string
  at: { x: number; y: number }
  onClose: () => void
}) {
  const store = useShapeEditorStore.getState()
  const layer = find(store.layers, id)?.layer
  if (!layer) return null
  const actions: MenuAction[] = [
    { label: layer.visible ? 'Hide' : 'Unhide', onSelect: () => store.toggleVisible(id) },
    { label: 'Find', onSelect: () => store.findLayer(id) },
    { label: 'Duplicate', onSelect: () => store.duplicateLayer(id) },
    { label: 'Delete', onSelect: () => store.removeLayer(id) },
  ]
  return <ContextMenu at={at} actions={actions} onClose={onClose} />
}
