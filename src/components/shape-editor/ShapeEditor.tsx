import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  closeEditor,
  openEditor,
  pictureOf,
  type EditorOrigin,
  type EditorParts,
} from '../../lib/editorMotion'
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
import { LayerMenu } from './LayerMenu'
import { Palette } from './Palette'
import { BUTTON, PANEL, PANEL_HEAD, PRIMARY } from './styles'
import { TemplatesDialog } from './TemplatesDialog'
import { Viewport } from './Viewport'

/**
 * The //generate shape editor, full screen.
 *
 * `docs/generate-editor.md` § The layer stack is the design. The 3D view fills the
 * whole editor, and everything else floats over it: an opaque header, then the shapes
 * panel and the inspector either side of an opening onto the view, then the command
 * bar, one gutter apart and one gutter from the edges. The opening is framed so the
 * build sits centred in it rather than in the window.
 *
 * It edits the document in `useShapeEditorStore`; whoever opens it loads that first
 * and reads it back on Done, which is called once the closing motion has run
 * (`editorMotion.ts`). It fills whatever box it is given, which is the area below the
 * app header.
 */
export function ShapeEditor({
  onDone,
  origin = () => null,
}: {
  onDone: (command: StackCommand) => void
  /** Where the sheet's preview is, which the editor opens out of and closes into. */
  origin?: () => EditorOrigin | null
}) {
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
  const [layerMenu, setLayerMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(
    null,
  )
  const openLayerMenu = useCallback(
    (id: string, at: { x: number; y: number }) => setLayerMenu({ id, at }),
    [],
  )
  const closeTemplates = useCallback(() => setTemplates(false), [])

  useEditorKeys()
  const parts = useParts()
  const leaving = useRef(false)
  useLayoutEffect(() => {
    const ready = parts.ready()
    return ready === null ? undefined : openEditor(ready, origin())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, like the open it animates
  }, [])
  const done = () => {
    if (leaving.current) return
    leaving.current = true
    const ready = parts.ready()
    if (ready === null) onDone(command)
    else {
      const target = () => origin()?.rect ?? null
      closeEditor(ready, pictureOf(ready.stage), target, () => onDone(command))
    }
  }

  return (
    <div ref={parts.root} className="relative h-full">
      <div ref={parts.stageRef} aria-hidden="true" className="bg-canvas absolute inset-0" />
      {/* The picture the opening and closing motion moves; hidden the rest of the time. */}
      <img
        ref={parts.picture}
        alt=""
        hidden
        className="bg-canvas pointer-events-none absolute inset-0 size-full origin-top-left object-cover"
      />
      {/* Over the view and letting it through: only the header and the tiles take the
        pointer, so the gutters between them orbit the camera too. */}
      <div className="pointer-events-none absolute inset-0 grid grid-rows-[auto_minmax(0,1fr)_auto] gap-2.5 pb-2.5">
        <header
          ref={parts.header}
          className="border-b-hairline border-border-subtle bg-surface pointer-events-auto flex min-w-0 flex-wrap items-center gap-3.5 px-3 py-2"
        >
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
            <button type="button" onClick={done} className={`${PRIMARY} ${FOCUS}`}>
              Done
            </button>
          </div>
        </header>

        <main className="mx-2.5 grid min-h-0 grid-cols-1 gap-2.5 md:grid-cols-[calc(var(--spacing)*53)_minmax(0,1fr)_calc(var(--spacing)*61)] xl:grid-cols-[calc(var(--spacing)*59)_minmax(0,1fr)_calc(var(--spacing)*75)]">
          <aside ref={parts.left} aria-label="Shapes" className={`${PANEL} pointer-events-auto`}>
            <div className={PANEL_HEAD}>
              Shapes
              <span className="bg-canvas text-text-muted text-2xs rounded-sm px-1.5 font-mono">
                {countShapes(layers)}
              </span>
            </div>
            <Palette onAdd={add} />
            <LayerList onMenu={openLayerMenu} onListMenu={setListMenu} />
          </aside>
          <Viewport
            opening={parts.opening}
            stage={parts.stage}
            expression={command.expression}
            onMenu={openLayerMenu}
          />
          <aside
            ref={parts.right}
            aria-label="Inspector"
            className={`${PANEL} pointer-events-auto`}
          >
            <Inspector />
          </aside>
        </main>

        <CommandBar ref={parts.bottom} command={command} />
      </div>

      {layerMenu && <LayerMenu {...layerMenu} onClose={() => setLayerMenu(null)} />}
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

/** W, E and R: the gizmo each picks, which also enters Edit. */
const GIZMO_KEYS = { w: 'translate', e: 'rotate', r: 'scale' } as const

/**
 * The editor's keys, while it is open.
 *
 * Undo and redo always, as in the command editor (`CommandWorkbench` explains why).
 * The rest only when no field has the keyboard, so typing an `s` into a name does not
 * isolate anything. Enter enters Edit; Escape leaves it, and in View lets go of the
 * selection.
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
      const target = event.target as Element | null
      if (target?.closest?.('input, textarea, select')) return
      const { selected } = store
      if (mod && key === 'd' && selected !== null) {
        event.preventDefault()
        store.duplicateLayer(selected)
      } else if (mod || event.altKey) {
        return
      } else if ((key === 'delete' || key === 'backspace') && selected !== null) {
        event.preventDefault()
        store.removeLayer(selected)
      } else if (key === 'f') {
        store.findLayer(selected)
      } else if (key === 's') {
        event.preventDefault()
        store.setIsolate(store.isolate !== null ? null : selected)
      } else if (key === 'enter') {
        // A focused button or menu item keeps Enter for itself.
        if (target?.closest?.('button, a, [role="option"], [role^="menuitem"]')) return
        event.preventDefault()
        store.setEdit({ on: true })
      } else if (key in GIZMO_KEYS) {
        store.setEdit({ on: true, mode: GIZMO_KEYS[key as keyof typeof GIZMO_KEYS] })
      } else if (key === 'escape') {
        if (store.dragging) return
        if (store.edit.on) store.setEdit({ on: false })
        else store.select(null)
      }
    }
    // Escape closes the editor's own menus and nothing else: marked as taken before the
    // sheet around the editor hears it, so it does not close the sheet underneath.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keydown', onEscape, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keydown', onEscape, true)
    }
  }, [])
}

/**
 * Refs to the parts the opening and closing motion moves, and all of them once mounted.
 *
 * The stage is held as state as well as a ref: the view's canvas is portalled into it,
 * so the viewport has to render again once it exists.
 */
function useParts() {
  const root = useRef<HTMLDivElement>(null)
  const stageEl = useRef<HTMLDivElement | null>(null)
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stageEl.current = el
    setStage(el)
  }, [])
  const picture = useRef<HTMLImageElement>(null)
  const header = useRef<HTMLElement>(null)
  const opening = useRef<HTMLElement>(null)
  const left = useRef<HTMLElement>(null)
  const bottom = useRef<HTMLElement>(null)
  const right = useRef<HTMLElement>(null)
  const ready = (): EditorParts | null => {
    const [o, s, p, h, v, l, f, r] = [
      root.current,
      stageEl.current,
      picture.current,
      header.current,
      opening.current,
      left.current,
      bottom.current,
      right.current,
    ]
    if (!o || !s || !p || !h || !v || !l || !f || !r) return null
    return { root: o, stage: s, picture: p, opening: v, header: h, left: l, bottom: f, right: r }
  }
  return { root, stage, stageRef, picture, header, opening, left, bottom, right, ready }
}
