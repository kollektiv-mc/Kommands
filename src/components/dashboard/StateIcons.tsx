import type { IconName } from '../../lib/icons'
import { Icon } from '../ui/Icon'

/**
 * The small marks after a command's name in a list: linked, pinned, and a warning when
 * it will not reopen as saved. Faint until the row is hovered, which the row grants
 * with the `group` class.
 */
export function StateIcons({
  linked,
  pinned,
  warning,
}: {
  linked: boolean
  pinned: boolean
  /** Why the command will not reopen as saved, or null when it will. */
  warning?: string | null
}) {
  if (!linked && !pinned && !warning) return null
  return (
    <span className="text-accent duration-fast flex shrink-0 items-center gap-0.5 opacity-30 transition-opacity group-hover:opacity-100">
      {linked && <Mark name="link" label="Linked" />}
      {pinned && <Mark name="pin" label="Pinned" />}
      {warning && <Warning note={warning} small />}
    </span>
  )
}

function Mark({ name, label }: { name: IconName; label: string }) {
  return (
    <span title={label}>
      <Icon name={name} size="xs" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** The amber mark shown when a command will not reopen as saved, carrying the reason. */
export function Warning({ note, small = false }: { note: string; small?: boolean }) {
  return (
    <span title={note} className="text-warning shrink-0">
      <Icon name="warning" size={small ? 'xs' : 'md'} />
      <span className="sr-only">{note}</span>
    </span>
  )
}
