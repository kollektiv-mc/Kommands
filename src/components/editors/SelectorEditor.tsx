import type { EditorProps } from '../../schema/types'
import { selectorsFor } from '../../data/authored/selectors'
import { FIELD } from './fieldStyles'

/**
 * Backs `entity_selector`.
 *
 * The shorthands offered narrow by the Brigadier `type` and `amount` properties, and
 * come from src/data/authored/selectors.ts — they are game values, so they are data
 * rather than literals written here. A full selector builder (@e[type=…,distance=…])
 * is later work; free text is accepted meanwhile so nothing is unreachable.
 */
export function SelectorEditor({ value, onChange, options, diagnostics }: EditorProps<string>) {
  const shorthands = selectorsFor(options)
  const listId = `selectors-${shorthands.map((s) => s.token).join('')}`
  return (
    <>
      <input
        type="text"
        className={FIELD}
        value={value}
        list={listId}
        aria-invalid={diagnostics.length > 0}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {shorthands.map((s) => (
          <option key={s.token} value={s.token}>
            {s.label}
          </option>
        ))}
      </datalist>
    </>
  )
}
