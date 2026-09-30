import type { EditorProps } from '../../schema/types'
import {
  joinCoordinates,
  relativeHere,
  splitCoordinates,
  type CoordinateShape,
} from '../../schema/coordinates'
import { defaultText } from '../../schema/default-text'
import { FIELD, FOCUS } from './fieldStyles'

/**
 * One field per axis, and a button that fills them all with `~`.
 *
 * Separate fields rather than one, because the one field was where positions went
 * wrong: `~ ~1` with the z left off reads as finished and slides the next argument
 * into z's slot. With a field per axis a missing part is an empty box, and the
 * serializer writes the `<name>` placeholder until it is filled.
 *
 * "Here" (or "Current", for a rotation) is the value people type most, `~ ~ ~`: where,
 * or which way, the command is run from.
 */
export function coordinateEditor(shape: CoordinateShape) {
  return function CoordinateEditor({
    value,
    onChange,
    options,
    diagnostics,
    describedBy,
  }: EditorProps<string>) {
    const parts = splitCoordinates(value, shape.axes.length)
    // The game's value for an empty argument, split across the fields it belongs in.
    const fallback = splitCoordinates(defaultText(options) ?? '', shape.axes.length)
    const set = (i: number, next: string) =>
      onChange(joinCoordinates(parts.map((p, j) => (j === i ? next.replace(/\s/g, '') : p))))
    const here = relativeHere(shape)

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {shape.axes.map((axis, i) => (
          <input
            key={axis}
            type="text"
            inputMode="decimal"
            spellCheck={false}
            aria-label={axis}
            aria-describedby={describedBy}
            aria-invalid={diagnostics.length > 0}
            value={parts[i]}
            placeholder={fallback[i] || axis}
            onChange={(event) => set(i, event.target.value)}
            className={`${FIELD} w-20 text-center`}
          />
        ))}
        <button
          type="button"
          aria-pressed={value === here}
          onClick={() => onChange(value === here ? '' : here)}
          className={`${FOCUS} text-accent hover:bg-accent/10 aria-pressed:bg-accent/15 duration-fast rounded-md px-2 py-1 text-xs font-medium transition-colors motion-reduce:transition-none`}
        >
          {shape.fill}
        </button>
      </div>
    )
  }
}
