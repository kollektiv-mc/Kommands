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
 * There used to be an empty gutter a sixth of the width between the two, meant to set
 * the list apart from the builder. In practice it pushed the form a sixth of the way
 * across the panel and left it looking misplaced, and the hairline between the two
 * already says they are different things. The builder now starts beside the list and
 * stops at a width a row of label and field reads well at, rather than stretching two
 * fields apart across a wide window.
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
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="max-w-3xl px-6 pt-5 pb-12">{children}</div>
      </div>
    </div>
  )
}
