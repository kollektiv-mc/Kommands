import { useMotion } from '../../lib/useMotion'

/**
 * Text that fades from one value to the next instead of being overwritten: the old
 * words fade out where they stood while the new ones fade in, and the space between
 * them glides to the new width.
 *
 * Keyed on the text, so it animates when the text changes and at no other time.
 */
export function Swap({ text, className = '' }: { text: string; className?: string }) {
  const [box] = useMotion<HTMLSpanElement>()
  return (
    <span ref={box} className={`relative inline-flex min-w-0 ${className}`}>
      <span key={text} className="min-w-0 truncate">
        {text}
      </span>
    </span>
  )
}
