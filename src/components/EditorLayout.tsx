import type { ReactNode } from 'react'
import { CommandNav } from './CommandNav'
import type { Catalogue } from './CommandRenderer'

/**
 * What the sheet holds: the chosen command, or, before one is chosen, the list to
 * choose it from.
 *
 * The list used to run down the side of every command, which kept a column of the
 * panel for something used once per visit. It now lives behind the command's name in
 * the header (`CommandSwitcher`), and is the whole sheet only on `/c`, where choosing
 * is the one thing to do.
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
  if (activeId === undefined) {
    return (
      <div className="editor-list p-2">
        <CommandNav catalogue={catalogue} focusFilter />
      </div>
    )
  }
  return <div className="p-4">{children}</div>
}
