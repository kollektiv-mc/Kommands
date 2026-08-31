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
 *
 * The gutter between the two is the third element here, and it is empty on purpose.
 * The list and the builder are different *kinds* of thing — one is a table of contents
 * for the whole app, the other is the one command being built — and with a hairline
 * between them and nothing else they read as two columns of one document. A sixth of
 * the width of canvas is what makes the builder read as the page and the list as
 * navigation beside it.
 *
 * A flex sibling rather than padding on the pane, because it has to stay outside the
 * scroll container: padding-left on a scrolling pane scrolls its content away from the
 * gutter horizontally and moves under the nav, which is exactly the seam this is here
 * to open.
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
      <div aria-hidden="true" className="w-1/6 shrink-0" />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto py-3 pr-3">{children}</div>
    </div>
  )
}
