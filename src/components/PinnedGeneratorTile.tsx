import { Link } from '@tanstack/react-router'
import type { PinnedGenerator } from '../storage/preferences'
import { IconButton } from './ui/IconButton'
import { Icon } from './ui/Icon'
import { REVEALED, useReveal } from './dashboard/useReveal'

/**
 * One pinned generator: its label and id, a link to start a fresh command with it.
 *
 * The link is stretched over the whole card so middle-click and open-in-new-tab work
 * anywhere on it. The label is snapshotted at pin time and never resolved from the
 * catalogue, which the dashboard does not load. Unpinning is the round badge on the top
 * right corner, which fades in as the pointer nears it.
 */
export function PinnedGeneratorTile({
  generator,
  onUnpin,
}: {
  generator: PinnedGenerator
  onUnpin: () => void
}) {
  const { card, control } = useReveal('top-right')
  return (
    <li
      ref={card}
      className="border-hairline border-border-subtle bg-surface hover:border-border-hover duration-fast relative flex min-w-0 flex-col gap-1 rounded-md px-3.5 py-3"
    >
      <Link
        to="/c/$commandId"
        params={{ commandId: generator.id }}
        aria-label={generator.label}
        className="absolute inset-0 rounded-md"
      />
      <span className="text-text-primary pointer-events-none relative truncate font-mono text-sm font-semibold">
        {generator.label}
      </span>
      <span className="text-text-secondary text-1xs pointer-events-none relative truncate font-mono">
        {generator.id}
      </span>
      <span className="absolute top-1 right-1">
        <IconButton
          small
          ref={control}
          tone="danger"
          onClick={onUnpin}
          title={`Unpin ${generator.label}`}
          className={`bg-overlay border-hairline border-border-hover rounded-full ${REVEALED}`}
        >
          <Icon name="close" size="xs" />
        </IconButton>
      </span>
    </li>
  )
}
