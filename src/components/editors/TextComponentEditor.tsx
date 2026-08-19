import type { TextComponent } from '../../schema/text-component'
import type { EditorProps } from '../../schema/types'
import { TEXT_COLORS } from '../../data/authored/text-colors'
import { FIELD, LABEL } from './fieldStyles'

/**
 * Backs `text_component`, and the item components that carry one.
 *
 * Covers text, colour and the formatting flags — enough for `custom_name` and `lore`.
 * The rest of the component grammar (`extra` children, `translate`, `selector`,
 * `score`, click and hover events) is #8's, and adds fields here rather than
 * replacing the component: the value is a tree either way, and which form it is
 * written in is a trait branch inside the serializer, not something this editor knows.
 */

/** The flags a component may carry, in the order they are written. */
const FLAGS = ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'] as const

interface TextComponentFieldsProps {
  value: TextComponent
  onChange: (next: TextComponent) => void
  ariaPrefix: string
}

export function TextComponentFields({ value, onChange, ariaPrefix }: TextComponentFieldsProps) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        className={FIELD}
        value={value.text}
        aria-label={`${ariaPrefix} text`}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
      />
      <select
        className={FIELD}
        value={value.color ?? ''}
        aria-label={`${ariaPrefix} colour`}
        onChange={(e) => onChange({ ...value, color: e.target.value || undefined })}
      >
        <option value="">no colour</option>
        {TEXT_COLORS.map((color) => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
      </select>
      {FLAGS.map((flag) => (
        <label key={flag} className="flex items-center gap-1">
          <input
            type="checkbox"
            className="accent-accent"
            checked={value[flag] === true}
            aria-label={`${ariaPrefix} ${flag}`}
            // Unset rather than false: a flag written as false is a field in the
            // output, and an untouched checkbox should leave the component alone.
            onChange={(e) => onChange({ ...value, [flag]: e.target.checked ? true : undefined })}
          />
          <span className={LABEL}>{flag}</span>
        </label>
      ))}
    </span>
  )
}

export function TextComponentEditor({ value, onChange }: EditorProps<TextComponent>) {
  return <TextComponentFields value={value} onChange={onChange} ariaPrefix="Message" />
}
