// aislop-ignore-file jsx-a11y/prefer-tag-over-role -- this file is the replacement for <select> and <option>, which the platform draws and no stylesheet reaches (see docs/design-tokens.md § Component patterns)
import { useEffect, useRef, type MouseEvent } from 'react'
import { optionId, type ListOption } from '../../lib/listbox'
import { Icon } from './Icon'

/**
 * The options inside a Listbox or a Combobox popover.
 *
 * Focus never enters the list. The trigger (a button or an input) keeps it and names
 * the highlighted option through `aria-activedescendant`, which is what lets a screen
 * reader announce the option under the arrow keys while typing still lands in the
 * input. That is also why each option is `tabIndex={-1}`: it is a click target for the
 * pointer, not a stop in the tab order.
 */
export function OptionList<V extends string>({
  id,
  options,
  selected,
  active,
  onPick,
  onHover,
  label,
}: {
  id: string
  options: readonly ListOption<V>[]
  selected: string
  active: number
  onPick: (option: ListOption<V>) => void
  onHover: (index: number) => void
  label?: string
}) {
  const list = useRef<HTMLDivElement>(null)

  // Keeps the highlighted option in view as the arrow keys walk past the edge.
  // `scrollIntoView` is optional because jsdom has no layout and does not define it.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const pick = (event: MouseEvent, option: ListOption<V>) => {
    // Cancelled so a click here cannot activate a `<label>` the control sits inside,
    // which would click the trigger again and reopen the list just closed.
    event.preventDefault()
    onPick(option)
  }

  return (
    <div
      ref={list}
      id={id}
      role="listbox"
      aria-label={label}
      className="flex max-h-60 flex-col gap-px overflow-y-auto"
    >
      {options.map((option, i) => {
        const isSelected = option.value === selected
        return (
          <button
            key={option.value}
            id={optionId(id, i)}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={isSelected}
            // Named by the label alone and described by the line beside it, so a screen
            // reader says "give", then "apply an effect", rather than running the two
            // together as one word.
            aria-labelledby={`${optionId(id, i)}-label`}
            aria-describedby={option.description ? `${optionId(id, i)}-description` : undefined}
            data-active={i === active}
            onMouseEnter={() => onHover(i)}
            onClick={(event) => pick(event, option)}
            className={
              'duration-fast flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors motion-reduce:transition-none ' +
              (i === active ? 'bg-hover ' : '') +
              (isSelected ? 'text-accent' : 'text-text-primary')
            }
          >
            <Icon
              name="check"
              size="sm"
              className={`self-center ${isSelected ? 'text-accent' : 'opacity-0'}`}
            />
            <span id={`${optionId(id, i)}-label`} className="min-w-0 truncate">
              {option.label}
            </span>
            {option.description && (
              <span
                id={`${optionId(id, i)}-description`}
                className="text-text-muted text-1xs ml-auto pl-3 font-sans whitespace-nowrap"
              >
                {option.description}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
