import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { eachLayer, find, idleLayers, isolated, type Slot } from '../../worldedit/stack/edit'
import { KIND_LABELS, type Layer } from '../../worldedit/stack/layers'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { FOCUS } from '../editors/fieldStyles'
import { Glyph } from './glyphs'
import { OP_GLYPH, OP_LABEL, OP_TONE } from './styles'

/**
 * The layer list: the document, read top to bottom.
 *
 * A group is a tile with its children inside it, so a nested list reads as nesting
 * rather than as indentation alone. Rows drag to reorder, onto the upper or lower half
 * of a row to land before or after it, and onto the middle of a group to land inside.
 */

type Where = 'before' | 'after' | 'into'

const kindOf = (layer: Layer): string =>
  layer.type === 'group' || layer.type === 'reference'
    ? KIND_LABELS[layer.type]
    : KIND_LABELS[layer.kind]

export function LayerList({
  onMenu,
  onListMenu,
}: {
  /** A right-click on a row: that layer's menu. */
  onMenu: (id: string, at: { x: number; y: number }) => void
  /** A right-click on the list outside any row. */
  onListMenu: (at: { x: number; y: number }) => void
}) {
  const layers = useShapeEditorStore((s) => s.layers)
  const isolate = useShapeEditorStore((s) => s.isolate)
  const idle = useMemo(() => idleLayers(layers), [layers])
  const shown = useMemo(() => {
    const view = isolate === null ? null : isolated(layers, isolate)
    return view === null ? null : new Set([...eachLayer(view)].map((l) => l.id))
  }, [layers, isolate])
  const drag = useDrop(layers)

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-auto"
      onContextMenu={(event) => {
        if ((event.target as Element).closest('[data-row]')) return
        event.preventDefault()
        onListMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {layers.length === 0 ? (
        <p className="text-text-muted px-3 py-3.5 text-xs">No shapes yet</p>
      ) : (
        <ul role="tree" aria-label="Layers" className="flex flex-col gap-px p-1.5 pb-10">
          {layers.map((layer) => (
            <LayerNode
              key={layer.id}
              layer={layer}
              idle={idle}
              shown={shown}
              drag={drag}
              onMenu={(id, x, y) => onMenu(id, { x, y })}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface Drag {
  dragging: string | null
  target: { id: string; where: Where } | null
  start: (id: string, event: DragEvent) => void
  over: (id: string, isGroup: boolean, event: DragEvent) => void
  drop: (event: DragEvent) => void
  end: () => void
}

function useDrop(layers: readonly Layer[]): Drag {
  const [dragging, setDragging] = useState<string | null>(null)
  const [target, setTarget] = useState<Drag['target']>(null)
  const moveLayer = useShapeEditorStore((s) => s.moveLayer)

  const end = () => {
    setDragging(null)
    setTarget(null)
  }

  return {
    dragging,
    target,
    start: (id, event) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
      setDragging(id)
    },
    over: (id, isGroup, event) => {
      if (dragging === null || dragging === id) return
      const from = find(layers, dragging)
      // A group cannot go inside itself.
      if (from?.layer.type === 'group' && [...eachLayer([from.layer])].some((l) => l.id === id))
        return
      event.preventDefault()
      const box = event.currentTarget.getBoundingClientRect()
      const f = (event.clientY - box.top) / box.height
      const where: Where = isGroup && f > 0.3 && f < 0.7 ? 'into' : f < 0.5 ? 'before' : 'after'
      if (target?.id !== id || target.where !== where) setTarget({ id, where })
    },
    drop: (event) => {
      event.preventDefault()
      if (dragging !== null && target !== null) {
        const slot = slotAt(layers, target.id, target.where)
        if (slot) moveLayer(dragging, slot)
      }
      end()
    },
    end,
  }
}

function slotAt(layers: readonly Layer[], id: string, where: Where): Slot | null {
  const at = find(layers, id)
  if (!at) return null
  if (where === 'into' && at.layer.type === 'group') {
    return { parent: id, index: at.layer.children.length }
  }
  const parent = at.parents.at(-1)?.id ?? null
  return { parent, index: where === 'before' ? at.index : at.index + 1 }
}

function LayerNode({
  layer,
  idle,
  shown,
  drag,
  onMenu,
}: {
  layer: Layer
  idle: ReadonlyMap<string, string>
  shown: ReadonlySet<string> | null
  drag: Drag
  onMenu: (id: string, x: number, y: number) => void
}) {
  const selected = useShapeEditorStore((s) => s.selected === layer.id)
  const row = (
    <Row
      layer={layer}
      idle={idle.get(layer.id)}
      out={shown !== null && !shown.has(layer.id)}
      drag={drag}
      onMenu={onMenu}
    />
  )
  if (layer.type !== 'group')
    return (
      <li role="treeitem" aria-selected={selected}>
        {row}
      </li>
    )
  return (
    <li
      role="treeitem"
      aria-selected={selected}
      aria-expanded={layer.open}
      className={`border-hairline bg-surface flex flex-col gap-px rounded-md ${selected ? 'border-accent/40' : 'border-border-subtle'}`}
    >
      {row}
      {layer.open && (
        <ul
          // aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- the tree pattern: a treeitem's children are a group, and a fieldset would end the tree
          role="group"
          className={`border-l-hairline mr-1 mb-1 ml-3.5 flex flex-col gap-px pl-1.5 ${selected ? 'border-accent/50' : 'border-border-hover'}`}
        >
          {layer.children.length === 0 ? (
            // aislop-ignore-next-line jsx-a11y/no-noninteractive-element-interactions -- a drop target for a pointer drag; Group in the inspector is the keyboard's way in
            <li
              className="text-text-faint text-1xs flex h-7.5 items-center pl-3.5"
              onDragOver={(e) => drag.over(layer.id, true, e)}
              onDrop={drag.drop}
            >
              Empty
            </li>
          ) : (
            layer.children.map((child) => (
              <LayerNode
                key={child.id}
                layer={child}
                idle={idle}
                shown={shown}
                drag={drag}
                onMenu={onMenu}
              />
            ))
          )}
        </ul>
      )}
    </li>
  )
}

function Row({
  layer,
  idle,
  out,
  drag,
  onMenu,
}: {
  layer: Layer
  idle: string | undefined
  out: boolean
  drag: Drag
  onMenu: (id: string, x: number, y: number) => void
}) {
  const selected = useShapeEditorStore((s) => s.selected === layer.id)
  const store = useShapeEditorStore.getState()
  const [renaming, setRenaming] = useState(false)
  const kind = kindOf(layer)
  const tagged = layer.name !== kind
  const target = drag.target?.id === layer.id ? drag.target.where : null

  return (
    // The row is a drag source and drop target, a pointer gesture; its button below is
    // what the keyboard and a click reach.
    // aislop-ignore-next-line jsx-a11y/no-static-element-interactions -- drag and drop and the context menu only; selecting is the name button's
    <div
      data-row={layer.id}
      draggable={!renaming}
      onDragStart={(e) => drag.start(layer.id, e)}
      onDragOver={(e) => drag.over(layer.id, layer.type === 'group', e)}
      onDrop={drag.drop}
      onDragEnd={drag.end}
      onContextMenu={(e) => {
        e.preventDefault()
        store.select(layer.id)
        onMenu(layer.id, e.clientX, e.clientY)
      }}
      className={`group/row relative flex h-7.5 items-center gap-1.5 rounded-md border pr-1.5 pl-1 select-none ${
        selected
          ? 'border-accent/40 bg-accent/10 text-text-primary'
          : 'text-text-secondary hover:bg-hover hover:text-text-primary border-transparent'
      } ${out ? 'opacity-35' : ''} ${target === 'into' ? 'border-accent border-dashed' : ''} ${drag.dragging === layer.id ? 'opacity-50' : ''}`}
    >
      {target === 'before' && <DropLine edge="top" />}
      {target === 'after' && <DropLine edge="bottom" />}
      {layer.type === 'group' ? (
        <button
          type="button"
          aria-label={layer.open ? 'Fold' : 'Unfold'}
          onClick={(e) => {
            e.stopPropagation()
            store.toggleOpen(layer.id)
          }}
          className={`text-text-muted relative grid size-3.5 shrink-0 place-items-center ${FOCUS}`}
        >
          <Icon
            name="chevronDown"
            size="xs"
            className={`duration-fast transition-transform motion-reduce:transition-none ${layer.open ? '' : '-rotate-90'}`}
          />
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <Badge layer={layer} />
      <Glyph
        name={layer.type === 'group' || layer.type === 'reference' ? layer.type : layer.kind}
        size="sm"
        className={`${selected ? 'text-accent' : 'text-text-muted'} ${layer.visible ? '' : 'opacity-40'}`}
      />
      {renaming ? (
        <RenameField
          name={layer.name}
          onDone={(name) => {
            setRenaming(false)
            if (name !== null) store.rename(layer.id, name)
          }}
        />
      ) : (
        <button
          type="button"
          aria-current={selected ? 'true' : undefined}
          onClick={() => store.select(layer.id)}
          onDoubleClick={() => setRenaming(true)}
          onKeyDown={(e) => {
            if (e.key !== 'F2') return
            e.preventDefault()
            e.stopPropagation()
            setRenaming(true)
          }}
          className={`focus-visible:before:outline-accent flex min-w-0 flex-1 items-center gap-1.5 self-stretch text-left outline-none before:absolute before:inset-0 before:rounded-md focus-visible:before:outline-1`}
        >
          <span
            className={`${tagged ? 'flex-initial' : 'flex-1'} min-w-0 truncate font-medium ${layer.visible ? '' : 'opacity-40'}`}
          >
            {layer.name}
          </span>
          {tagged && (
            <span className="text-text-faint text-3xs mr-auto min-w-0 shrink-1000 truncate font-bold tracking-widest uppercase">
              {kind}
            </span>
          )}
        </button>
      )}
      {idle !== undefined && (
        <Tooltip label={idle}>
          <span className="relative size-1.5 shrink-0">
            <span aria-hidden="true" className="bg-warning absolute inset-0 rounded-full" />
            <span className="sr-only">{idle}</span>
          </span>
        </Tooltip>
      )}
      <button
        type="button"
        aria-label={layer.visible ? 'Hide' : 'Show'}
        aria-pressed={!layer.visible}
        onClick={(e) => {
          e.stopPropagation()
          store.toggleVisible(layer.id)
        }}
        className={`text-text-muted hover:text-text-primary hover:bg-hover relative grid size-5 shrink-0 place-items-center rounded-sm ${
          selected || !layer.visible
            ? ''
            : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'
        } ${FOCUS}`}
      >
        <Icon name={layer.visible ? 'eye' : 'eyeOff'} size="xs" />
      </button>
    </div>
  )
}

/** The op badge: a button that cycles Add, Cut, Overlap, or a modifier's or reference's mark. */
function Badge({ layer }: { layer: Layer }) {
  const BOX = 'grid h-4.5 w-5 shrink-0 place-items-center rounded-sm font-mono text-xs font-bold'
  if (layer.type === 'modifier' || layer.type === 'reference') {
    return (
      <span aria-hidden="true" className={`${BOX} bg-hover text-text-secondary`}>
        <Glyph name={layer.type === 'reference' ? 'reference' : layer.kind} size="sm" />
      </span>
    )
  }
  const { op } = layer
  return (
    <Tooltip label={`${OP_LABEL[op]}, click to change`}>
      <button
        type="button"
        aria-label={`Operation: ${OP_LABEL[op]}`}
        onClick={(e) => {
          e.stopPropagation()
          useShapeEditorStore.getState().cycleOp(layer.id)
        }}
        className={`${BOX} ${OP_TONE[op]} relative ${FOCUS}`}
      >
        {OP_GLYPH[op]}
      </button>
    </Tooltip>
  )
}

function DropLine({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden="true"
      className={`bg-accent pointer-events-none absolute inset-x-1.5 h-0.5 rounded-full ${edge === 'top' ? '-top-0.5' : '-bottom-0.5'}`}
    />
  )
}

function RenameField({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const done = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const finish = (value: string | null) => {
    if (done.current) return
    done.current = true
    onDone(value)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === 'Enter') finish(event.currentTarget.value)
    if (event.key === 'Escape') finish(null)
  }
  return (
    <input
      aria-label="Name"
      ref={input}
      defaultValue={name}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={onKeyDown}
      onBlur={(e) => finish(e.currentTarget.value)}
      onClick={(e) => e.stopPropagation()}
      className="border-hairline border-accent bg-canvas min-w-0 flex-1 rounded-sm px-1 py-px text-xs outline-none"
    />
  )
}
