import type { EditorProps } from '../../schema/types'
import { defaultText } from '../../schema/default-text'
import { Listbox } from '../ui/Listbox'
import { Segmented } from '../ui/Segmented'

/**
 * A closed set of words: a gamemode, an anchor, a mirror.
 *
 * A few short values are a segmented control, and a longer set a listbox, by the same
 * rule a Choice uses (`choiceControl`), so a row reads the same whichever kind of node
 * produced it. An optional one leads with "Default", stored as `''`: the argument is
 * left out and the game's own value applies, which the segment names when one is
 * authored.
 */
export function enumEditor(values: readonly string[], control: 'segmented' | 'listbox') {
  return function EnumEditor({ id, value, onChange, options, describedBy }: EditorProps<string>) {
    const given = defaultText(options)
    const choices = [
      // Named only when the default is not already one of the choices beside it:
      // "Default (none)" next to "none" says the same word twice.
      ...(options.optional
        ? [
            {
              value: '',
              label: given && !values.includes(given) ? `Default (${given})` : 'Default',
            },
          ]
        : []),
      ...values.map((v) => ({ value: v, label: v })),
    ]
    if (control === 'segmented') {
      return <Segmented value={value} options={choices} onChange={onChange} />
    }
    return (
      <Listbox
        id={id}
        value={value}
        options={choices}
        onChange={onChange}
        placeholder={given ?? 'choose…'}
        aria-describedby={describedBy}
        className="w-full max-w-xs"
      />
    )
  }
}
