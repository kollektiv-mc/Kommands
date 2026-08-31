import type { ReactNode } from 'react'
import { CommandNav } from './CommandNav'
import type { Catalogue } from './CommandRenderer'

/**
 * The editor's two panes: every command generator on the left, the chosen one beside it.
 *
 * The frame both editor routes render inside — the one with a command and the one
 * without — so the navbar does not unmount between them. That is not tidiness: the
 * filter someone typed lives in the navbar, and a navbar that remounted on every
 * selection would clear it on the first click.
 *
 * It used to own the entrance animation too, and no longer does. The thing that grows
 * out of a tile is the whole overlay panel, not this pane inside it, so the FLIP moved
 * to `CommandOverlay` and this went back to being layout and nothing else.
 */
export function EditorLayout({
  catalogue,
  activeId,
  children,
}: {
  catalogue: Catalogue
  activeId?: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0">
      <CommandNav catalogue={catalogue} activeId={activeId} />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  )
}
