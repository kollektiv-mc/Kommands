import type { EditorProps } from '../../schema/types'

/**
 * Backs `bool`.
 *
 * An optional bool has a third state, '' for "not given", and the box shows the value
 * the game assumes in that state rather than always showing false: `/random reset`'s
 * `includeWorldSeed` defaults to true, and an unchecked box there would claim the
 * opposite of what the command does. Putting the box back to that value stores '' again,
 * so toggling twice leaves the command as it was instead of spelling the default out.
 */
export function ToggleEditor({ value, onChange, options }: EditorProps<boolean | ''>) {
  const assumed = options.default === true
  const checked = value === '' ? assumed : value
  return (
    <input
      type="checkbox"
      className="accent-accent"
      checked={checked}
      onChange={(e) =>
        onChange(options.optional === true && e.target.checked === assumed ? '' : e.target.checked)
      }
    />
  )
}
