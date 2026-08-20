import type { EditorProps } from '../../schema/types'
import { FIELD } from './fieldStyles'

/**
 * Backs `we_expression`.
 *
 * A textarea rather than an input, and that is what `variadic` buys: the argument
 * consumes every remaining token, so its value is a whole tail that may contain
 * spaces and wants room. A non-variadic argument holding `x^2+y^2+z^2 < 1` would be
 * three tokens to Brigadier and one to the form.
 *
 * The expression *language* is not parsed here — that is the standalone evaluator,
 * which the shape preview needs and this field does not. What is checked is the one
 * mistake that is certain rather than likely: unbalanced brackets.
 */
export function ExpressionEditor({ value, onChange, options, diagnostics }: EditorProps<string>) {
  return (
    <textarea
      className={`${FIELD} min-w-64 resize-y`}
      rows={options.variadic === true ? 2 : 1}
      value={value}
      spellCheck={false}
      aria-invalid={diagnostics.length > 0}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
