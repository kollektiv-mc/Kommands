import { useRef, useState, type DragEvent } from 'react'
import { cleanTag, type SavedCommand } from '../../schema/saved'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { StateIcons } from './StateIcons'
import { copyNote, useCopy } from './useCopy'
import { savedOn } from './dates'

/**
 * One saved command in the browser, on one line: name and marks, the command fading at
 * the right, its tags, the save date, and on hover the tag and edit buttons.
 *
 * A click copies it. It drags onto a group heading to move there. The tag button opens a
 * small field; Enter or leaving the field adds the tag, Escape drops it.
 */
export function BrowserRow({
  saved,
  warning,
  dragging,
  onDragStart,
  onDragEnd,
  onTags,
  onEdit,
}: {
  saved: SavedCommand
  warning: string | null
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onTags: (tags: readonly string[]) => void
  /** Given the row's element, so the editor can grow out of it. */
  onEdit: (element: HTMLElement) => void
}) {
  const [copied, copy] = useCopy()
  const [draft, setDraft] = useState<string | null>(null)
  const row = useRef<HTMLLIElement>(null)
  const tags = saved.tags ?? []
  const said = copyNote(copied)

  const commit = () => {
    const tag = cleanTag(draft ?? '')
    setDraft(null)
    if (tag !== '' && !tags.includes(tag)) onTags([...tags, tag])
  }

  return (
    <li
      ref={row}
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', saved.preview)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`group hover:bg-surface border-b-hairline border-border-subtle relative flex h-8.5 items-center gap-3 pr-1.5 pl-3 select-none ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      {/* Stretched over the row, as on a tile: the row is the copy target. */}
      <button
        type="button"
        onClick={() => copy(saved.preview)}
        aria-label={`Copy ${saved.name}`}
        className="absolute inset-0 cursor-copy"
      />
      <span className="pointer-events-none relative flex w-42 min-w-0 shrink-0 items-center gap-1.5">
        <span className="font-title text-text-primary min-w-0 truncate text-xs font-semibold">
          {saved.name}
        </span>
        <StateIcons
          linked={saved.linked === true}
          pinned={saved.pinned === true}
          warning={warning}
        />
      </span>
      <span className="text-text-secondary text-1xs pointer-events-none relative min-w-0 flex-1 overflow-hidden mask-r-from-80% font-mono whitespace-nowrap">
        {saved.preview}
      </span>
      <span className="relative flex shrink-0 items-center gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-hover text-text-secondary text-2xs flex h-4.5 items-center gap-0.5 rounded-full pr-1 pl-1.5 font-mono"
          >
            {tag}
            <button
              type="button"
              onClick={() => onTags(tags.filter((t) => t !== tag))}
              aria-label={`Remove tag ${tag} from ${saved.name}`}
              className="hover:text-danger flex size-3 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Icon name="close" size="xs" />
            </button>
          </span>
        ))}
        {draft !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              commit()
            }}
          >
            <input
              aria-label="New tag"
              maxLength={20}
              ref={(el) => el?.focus()}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  setDraft(null)
                }
              }}
              className="border-hairline border-accent text-text-primary text-2xs h-5 w-22 rounded-full bg-transparent px-1.5 font-mono outline-none"
            />
          </form>
        )}
      </span>
      <span
        className={`text-1xs pointer-events-none relative w-24 shrink-0 truncate font-mono ${said ? 'text-accent' : 'text-text-secondary'}`}
      >
        {said ?? savedOn(saved.updatedAt)}
      </span>
      <span className="relative flex shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton small title={`Tag ${saved.name}`} onClick={() => setDraft('')}>
          <Icon name="tag" size="xs" />
        </IconButton>
        <IconButton
          small
          title={`Edit ${saved.name}`}
          onClick={() => row.current && onEdit(row.current)}
        >
          <Icon name="pencil" size="xs" />
        </IconButton>
      </span>
    </li>
  )
}
