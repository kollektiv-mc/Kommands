import { useRef, useState, type DragEvent } from 'react'
import type { SavedCommand } from '../schema/saved'
import { IconButton } from './ui/IconButton'
import { Icon } from './ui/Icon'
import { copyNote, useCopy } from './dashboard/useCopy'
import { REVEALED, useReveal } from './dashboard/useReveal'
import { savedOn } from './dashboard/dates'
import { Warning } from './dashboard/StateIcons'

export interface TileDrag {
  /** This tile is the one being dragged. */
  dragging: boolean
  /** Another tile is being dragged over this one. */
  target: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}

/**
 * One saved command on the dashboard.
 *
 * A click anywhere copies the command, which is what the tile is for: the product is a
 * string pasted somewhere else. Edit opens it in the generator, growing out of this
 * tile. Dragging moves it among the other tiles.
 *
 * The name is a real button so the copy is reachable by keyboard; the `<li>` handler is
 * the pointer's way to the same thing. The command text fades into the console where it
 * is cut. The trash fades in as the pointer nears the bottom left, and a warning icon
 * says when the command will not reopen as saved.
 */
export function SavedCommandTile({
  saved,
  note,
  linkable,
  onEdit,
  onRemove,
  onPin,
  onLink,
  drag,
}: {
  saved: SavedCommand
  /** From `tileNote` in `dashboard/notes.ts`. */
  note: string | null
  /** Whether this build can link into Konnekt at all. Only the desktop build can. */
  linkable: boolean
  /** Given the tile's own element, so the editor can grow out of it. */
  onEdit: (element: HTMLElement) => void
  onRemove: () => void
  onPin: () => void
  onLink: () => void
  drag: TileDrag
}) {
  const [copied, copy] = useCopy()
  const [cut, setCut] = useState(false)
  const tile = useRef<HTMLLIElement>(null)
  const { card, control } = useReveal('bottom-left')
  const said = copyNote(copied)
  const pinned = saved.pinned === true
  const linked = saved.linked === true

  // Measured rather than guessed from the text length, so the fade appears exactly
  // when the second line is not the last one.
  const measure = (el: HTMLElement | null) => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setCut(el.scrollHeight > el.clientHeight + 1))
    observer.observe(el)
    return () => observer.disconnect()
  }

  const dragProps = {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', saved.preview)
      drag.onDragStart()
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      drag.onDragOver()
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      drag.onDrop()
    },
    onDragEnd: drag.onDragEnd,
  }

  return (
    <li
      ref={(el) => {
        tile.current = el
        return card(el)
      }}
      {...dragProps}
      data-saved-id={saved.id}
      className={
        'border-hairline bg-surface hover:border-border-hover duration-fast relative rounded-lg ' +
        'flex min-h-0 flex-col gap-1.5 overflow-hidden pt-2 pr-2.5 pb-1 pl-3 select-none ' +
        (drag.target ? 'border-accent ' : 'border-border-subtle ') +
        (drag.dragging ? 'opacity-40' : '')
      }
    >
      {/* Stretched over the tile: the tile is the copy target, and a real button keeps
          it reachable by keyboard. Everything drawn above it lets the press through,
          except the controls row. */}
      <button
        type="button"
        onClick={() => copy(saved.preview)}
        aria-label={`Copy ${saved.name}`}
        className="absolute inset-0 cursor-copy rounded-lg"
      />
      <div className="pointer-events-none relative flex min-h-5.5 items-center gap-2">
        <span className="font-title text-text-primary min-w-0 flex-1 truncate text-sm font-semibold">
          {saved.name}
        </span>
        {note && <Warning note={note} />}
      </div>

      <code className="bg-canvas border-hairline border-border-subtle text-text-primary text-1xs pointer-events-none relative shrink-0 rounded-md px-2 py-1.5 font-mono leading-normal break-all">
        <span
          ref={measure}
          className={`block h-[2lh] overflow-hidden ${cut ? 'mask-b-from-50% mask-b-to-100%' : ''}`}
        >
          {saved.preview || <span className="text-text-faint">empty command</span>}
        </span>
      </code>

      <span
        className={`text-1xs pointer-events-none relative truncate font-mono ${said ? 'text-accent' : 'text-text-secondary'}`}
      >
        {said ?? savedOn(saved.updatedAt)}
      </span>

      <div className="relative -mx-1 mt-auto flex items-center">
        <IconButton
          small
          ref={control}
          tone="danger"
          onClick={onRemove}
          title={`Delete ${saved.name}`}
          className={REVEALED}
        >
          <Icon name="trash" size="xs" />
        </IconButton>
        <span className="flex-1" />
        <IconButton
          small
          onClick={onLink}
          disabled={!linkable}
          aria-pressed={linked}
          title={
            !linkable
              ? `Link ${saved.name} into Konnekt: needs the desktop build`
              : linked
                ? `Unlink ${saved.name} from Konnekt`
                : `Link ${saved.name} into Konnekt`
          }
        >
          {/* The state colours the glyph, not the button, whose own tone would win. */}
          <Icon name="link" size="xs" className={linked ? 'text-accent' : ''} />
        </IconButton>
        <IconButton
          small
          onClick={onPin}
          aria-pressed={pinned}
          title={pinned ? `Unpin ${saved.name}` : `Pin ${saved.name}`}
        >
          <Icon name="pin" size="xs" filled={pinned} className={pinned ? 'text-accent' : ''} />
        </IconButton>
        <IconButton
          small
          onClick={() => {
            if (tile.current) onEdit(tile.current)
          }}
          title={`Edit ${saved.name}`}
        >
          <Icon name="pencil" size="xs" />
        </IconButton>
      </div>
    </li>
  )
}
