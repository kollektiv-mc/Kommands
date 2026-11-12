import { useState } from 'react'
import type { SavedCommand } from '../../schema/saved'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { BrowserRow } from './BrowserRow'
import { UNGROUPED, allTags, matches, sections, type BrowseMode } from './browse'

const MODES: readonly { id: BrowseMode; label: string }[] = [
  { id: 'group', label: 'Groups' },
  { id: 'generator', label: 'Generators' },
  { id: 'list', label: 'List' },
]

const PRESSED = 'aria-pressed:bg-hover aria-pressed:text-text-primary'

/**
 * Every saved command in compact rows, sliding up over the Saved commands body.
 *
 * Search, a choice of grouping (by group, by generator, or none) and tag chips that
 * filter. The one surface on the dashboard that scrolls; group headings stick to its top.
 * A row dragged onto a group heading is filed there. Hidden from the keyboard and
 * assistive tech while closed, through `inert`.
 */
export function SavedBrowser({
  open,
  commands,
  groups,
  warningFor,
  onClose,
  onGroup,
  onTags,
  onAddGroup,
  onEdit,
}: {
  open: boolean
  commands: readonly SavedCommand[]
  /** Group names offered even when nothing is filed under them. */
  groups: readonly string[]
  warningFor: (saved: SavedCommand) => string | null
  onClose: () => void
  onGroup: (id: string, group: string | undefined) => void
  onTags: (id: string, tags: readonly string[]) => void
  onAddGroup: (name: string) => void
  onEdit: (saved: SavedCommand, element: HTMLElement) => void
}) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<BrowseMode>('group')
  const [picked, setPicked] = useState<readonly string[]>([])
  const [closed, setClosed] = useState<readonly string[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)
  const [naming, setNaming] = useState<string | null>(null)
  // Rendered from the first open until the slide down ends, so a closed browser keeps
  // nothing in the page for tests or tab order to find, and closing still slides.
  const [live, setLive] = useState(open)
  if (open && !live) setLive(true)

  const hits = commands.filter((c) => matches(c, query, picked))
  const filtering = query.trim() !== '' || picked.length > 0
  const shown = sections(hits, mode, groups, filtering)
  const tags = allTags(commands)

  const addGroup = () => {
    if (naming !== null) onAddGroup(naming)
    setNaming(null)
  }

  return (
    <section
      aria-label="Saved commands browser"
      inert={!open}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !open) setLive(false)
      }}
      className={`bg-overlay border-t-hairline border-border-hover duration-panel ease-standard absolute inset-0 z-10 flex flex-col transition-transform motion-reduce:transition-none ${
        open ? 'translate-y-0' : 'translate-y-[calc(100%+--spacing(4))]'
      }`}
    >
      {live && (
        <>
          <div className="border-b-hairline border-border-subtle flex shrink-0 flex-wrap items-center gap-2 py-2 pr-2.5 pl-3">
            <label className="bg-canvas border-hairline border-border-subtle focus-within:border-accent flex h-7.5 max-w-90 flex-[1_1_--spacing(55)] items-center gap-2 rounded-md px-2.5">
              <Icon name="search" className="text-text-muted" />
              <input
                aria-label="Search saved commands"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose()
                }}
                className="text-text-primary placeholder:text-text-faint min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
              />
            </label>
            <fieldset className="bg-canvas border-hairline border-border-subtle m-0 flex min-w-0 rounded-md p-0.5">
              <legend className="sr-only">Group by</legend>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={m.id === mode}
                  onClick={() => setMode(m.id)}
                  className={`text-text-secondary text-1xs rounded-sm px-2.5 py-1 font-mono font-semibold ${PRESSED}`}
                >
                  {m.label}
                </button>
              ))}
            </fieldset>
            {mode === 'group' &&
              (naming === null ? (
                <IconButton title="New group" onClick={() => setNaming('')}>
                  <Icon name="plus" />
                </IconButton>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    addGroup()
                  }}
                >
                  <input
                    aria-label="New group"
                    ref={(el) => el?.focus()}
                    maxLength={30}
                    value={naming}
                    onChange={(e) => setNaming(e.target.value)}
                    onBlur={addGroup}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setNaming(null)
                      }
                    }}
                    className="border-hairline border-accent text-text-primary h-7 w-32 rounded-md bg-transparent px-2 font-mono text-xs outline-none"
                  />
                </form>
              ))}
            <span className="flex-1" />
            <span className="text-text-secondary text-1xs font-mono">{`${hits.length} of ${commands.length}`}</span>
            <IconButton title="Close browser" onClick={onClose}>
              <Icon name="chevronDown" />
            </IconButton>
          </div>

          {tags.length > 0 && (
            <fieldset className="border-b-hairline border-border-subtle m-0 flex min-w-0 shrink-0 flex-wrap gap-1.5 px-3 py-2">
              <legend className="sr-only">Tags</legend>
              {tags.map((tag) => {
                const on = picked.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked(on ? picked.filter((t) => t !== tag) : [...picked, tag])
                    }
                    className="border-hairline border-border-subtle text-text-secondary hover:border-border-hover hover:text-text-primary aria-pressed:border-accent aria-pressed:text-accent aria-pressed:bg-accent/10 text-1xs rounded-full px-2 py-0.5 font-mono"
                  >
                    {tag}
                  </button>
                )
              })}
            </fieldset>
          )}

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {shown.map((section) => {
              const key = `${mode}:${section.heading ?? ''}`
              const shut = closed.includes(key)
              const heading = section.heading
              const movable = mode === 'group' && heading !== null
              return [
                heading !== null && (
                  <li
                    key={`h:${key}`}
                    onDragOver={(e) => {
                      if (!movable || dragging === null) return
                      e.preventDefault()
                      setDropOn(key)
                    }}
                    onDragLeave={() => setDropOn((was) => (was === key ? null : was))}
                    onDrop={(e) => {
                      if (!movable || dragging === null) return
                      e.preventDefault()
                      onGroup(dragging, heading === UNGROUPED ? undefined : heading)
                      setDragging(null)
                      setDropOn(null)
                    }}
                    className={`bg-overlay from-hover to-hover border-b-hairline border-border-subtle sticky top-0 z-1 flex h-8.5 items-center gap-2 bg-linear-to-b px-3 ${
                      dropOn === key ? 'ring-accent ring-1 ring-inset' : ''
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={!shut}
                      onClick={() =>
                        setClosed(shut ? closed.filter((k) => k !== key) : [...closed, key])
                      }
                      className="font-title text-text-primary flex items-center gap-2 text-xs font-semibold"
                    >
                      <Icon
                        name="chevronDown"
                        size="sm"
                        className={`text-text-muted duration-fast transition-transform ${shut ? '-rotate-90' : ''}`}
                      />
                      {heading}
                    </button>
                    <span className="text-text-secondary text-1xs font-mono">
                      {section.commands.length}
                    </span>
                  </li>
                ),
                ...(shut
                  ? []
                  : section.commands.map((saved) => (
                      <BrowserRow
                        key={saved.id}
                        saved={saved}
                        warning={warningFor(saved)}
                        dragging={dragging === saved.id}
                        onDragStart={() => setDragging(saved.id)}
                        onDragEnd={() => {
                          setDragging(null)
                          setDropOn(null)
                        }}
                        onTags={(next) => onTags(saved.id, next)}
                        onEdit={(element) => onEdit(saved, element)}
                      />
                    ))),
              ]
            })}
            {hits.length === 0 && (
              <li className="text-text-secondary p-3.5 text-xs">No saved command matches.</li>
            )}
          </ul>
        </>
      )}
    </section>
  )
}
