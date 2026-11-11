import type { SavedCommand } from '../../schema/saved'
import { StateIcons } from './StateIcons'
import { copyNote, useCopy } from './useCopy'

/**
 * A saved command as one row of Recent, Quick or Linked: its name with faint link and
 * pin marks, and one line of the command fading out at the right. A click copies it.
 *
 * Height is fixed (`ROW_HEIGHT`) because the panel pages by how many rows fit.
 */
export function CommandRow({ saved }: { saved: SavedCommand }) {
  const [copied, copy] = useCopy()
  const said = copyNote(copied)
  return (
    <li className="group hover:bg-surface border-border-subtle not-first:border-t-hairline relative flex h-12 flex-col justify-center gap-0.5 px-3 select-none">
      <button
        type="button"
        onClick={() => copy(saved.preview)}
        aria-label={`Copy ${saved.name}`}
        className="absolute inset-0 cursor-copy"
      />
      <div className="pointer-events-none relative flex min-w-0 items-center gap-1.5">
        <span className="font-title text-text-primary min-w-0 truncate text-sm font-semibold">
          {saved.name}
        </span>
        <StateIcons linked={saved.linked === true} pinned={saved.pinned === true} />
        <span className="flex-1" />
        {said && <span className="text-accent text-1xs shrink-0 font-mono">{said}</span>}
      </div>
      <span className="text-text-secondary text-1xs pointer-events-none relative overflow-hidden mask-r-from-80% font-mono whitespace-nowrap">
        {saved.preview}
      </span>
    </li>
  )
}

/** A row's height in px, h-12 above. Panels divide their body by it to page. */
export const ROW_HEIGHT = 48
