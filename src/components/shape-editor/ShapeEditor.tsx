import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { canRedo, canUndo } from '../../stores/commandHistory'
import { stackCommand, type StackCommand } from '../../worldedit/stack/command'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { CommandBar } from './CommandBar'
import { ContextMenu } from './ContextMenu'
import { Inspector } from './Inspector'
import { LayerList } from './LayerList'
import { Palette } from './Palette'
import { BUTTON, PANEL, PANEL_HEAD, PRIMARY } from './styles'
import { TemplatesDialog } from './TemplatesDialog'
import { Viewport } from './Viewport'

/**
 * The //generate shape editor, full screen.
 *
 * `docs/generate-editor.md` § The layer stack is the design. Three tiles over the
 * command bar: the palette and layer list, the viewport, and the inspector. It edits
 * the document in `useShapeEditorStore`; whoever opens it loads that first and reads
 * it back on Done.
 */
export function ShapeEditor({ onDone }: { onDone: (command: StackCommand) => void }) {
  const layers = useShapeEditorStore((s) => s.layers)
  const pattern = useShapeEditorStore((s) => s.pattern)
  const hollow = useShapeEditorStore((s) => s.hollow)
  const round = useShapeEditorStore((s) => s.round)
  const history = useShapeEditorStore((s) => s.history)
  const undo = useShapeEditorStore((s) => s.undo)
  const redo = useShapeEditorStore((s) => s.redo)
  const add = useShapeEditorStore((s) => s.add)
  const command = useMemo(
    () => stackCommand({ layers, pattern, hollow, round }),
    [layers, pattern, hollow, round],
  )
  const [templates, setTemplates] = useState(false)
  const [listMenu, setListMenu] = useState<{ x: number; y: number } | null>(null)
  const closeTemplates = useCallback(() => setTemplates(false), [])

  useEditorKeys()

  return (
    <div className="bg-canvas fixed inset-0 z-40 grid grid-rows-[auto_minmax(0,1fr)_auto] gap-2.5 px-4 py-3">
      <header className="flex min-w-0 flex-wrap items-center gap-3.5">
        <span className="font-display text-accent text-sm font-bold">Kommands</span>
        <span className="text-text-faint">/</span>
        <h1 className="font-mono text-lg font-medium">//generate</h1>
        <span className="flex-1" />
        <div className="flex items-center gap-1.5">
          <Tooltip label="Undo (Ctrl+Z)" side="bottom">
            <button
              type="button"
              aria-label="Undo"
              disabled={!canUndo(history)}
              onClick={undo}
              className={`${BUTTON} w-7.5 px-0 ${FOCUS}`}
            >
              <Icon name="undo" size="sm" />
            </button>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Shift+Z)" side="bottom">
            <button
              type="button"
              aria-label="Redo"
              disabled={!canRedo(history)}
              onClick={redo}
              className={`${BUTTON} w-7.5 px-0 ${FOCUS}`}
            >
              <Icon name="redo" size="sm" />
            </button>
          </Tooltip>
          <button type="button" onClick={() => onDone(command)} className={`${PRIMARY} ${FOCUS}`}>
            Done
          </button>
        </div>
      </header>

      <main className="grid min-h-0 grid-cols-1 gap-2.5 md:grid-cols-[calc(var(--spacing)*53)_minmax(0,1fr)_calc(var(--spacing)*61)] xl:grid-cols-[calc(var(--spacing)*59)_minmax(0,1fr)_calc(var(--spacing)*75)]">
        <aside aria-label="Shapes" className={PANEL}>
          <div className={PANEL_HEAD}>
            Shapes
            <span className="bg-canvas text-text-muted text-2xs rounded-sm px-1.5 font-mono">
              {countShapes(layers)}
            </span>
          </div>
          <Palette onAdd={add} />
          <LayerList onFind={() => {}} onListMenu={setListMenu} />
        </aside>
        <Viewport expression={command.expression} />
        <aside aria-label="Inspector" className={PANEL}>
          <Inspector />
        </aside>
      </main>

      <CommandBar command={command} />

      {listMenu && (
        <ContextMenu
          at={listMenu}
          onClose={() => setListMenu(null)}
          actions={[{ label: 'Use Template', onSelect: () => setTemplates(true) }]}
        />
      )}
      {templates && (
        <TemplatesDialog
          onClose={closeTemplates}
          onPick={(template) => {
            useShapeEditorStore.getState().applyTemplate(template)
            setTemplates(false)
          }}
        />
      )}
    </div>
  )
}

function countShapes(layers: ReturnType<typeof useShapeEditorStore.getState>['layers']): number {
  let n = 0
  for (const layer of layers) n += layer.type === 'group' ? countShapes(layer.children) : 1
  return n
}

/**
 * The editor's keys, while it is open.
 *
 * Undo and redo always, as in the command editor (`CommandWorkbench` explains why).
 * The rest only when no field has the keyboard, so typing an `s` into a name does not
 * isolate anything.
 */
function useEditorKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useShapeEditorStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      const typing = (event.target as Element | null)?.closest?.('input, textarea, select')
      if (typing) return
      const { selected } = store
      if (mod && key === 'd' && selected !== null) {
        event.preventDefault()
        store.duplicateLayer(selected)
      } else if ((key === 'delete' || key === 'backspace') && selected !== null) {
        event.preventDefault()
        store.removeLayer(selected)
      } else if (key === 's' && !mod) {
        event.preventDefault()
        store.setIsolate(store.isolate !== null ? null : selected)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
