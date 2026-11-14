import { FOCUS } from '../editors/fieldStyles'
import { EYEBROW, SEG_BUTTON } from './styles'

/** A titled row of pressed buttons, one of which is chosen. */
export function Chips<V extends string | number>({
  title,
  options,
  value,
  onPick,
  disabled = false,
}: {
  title: string
  options: readonly (readonly [V, string])[]
  value: V
  onPick: (value: V) => void
  disabled?: boolean
}) {
  return (
    // aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- a row of pressed buttons, as the toolbar's segments are; a fieldset would draw a border the popover already has
    <div role="group" aria-label={title}>
      <div className={`${EYEBROW} px-2 pt-2 pb-1`}>{title}</div>
      <div className="flex gap-0.5 px-1 pb-1">
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            disabled={disabled}
            onClick={() => onPick(v)}
            className={`${SEG_BUTTON} flex-1 justify-center disabled:opacity-40 ${FOCUS}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
