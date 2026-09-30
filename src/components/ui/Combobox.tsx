import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { filterOptions, optionId, stepIndex, type ListOption } from '../../lib/listbox'
import { FIELD } from '../editors/fieldStyles'
import { Icon } from './Icon'
import { OptionList } from './OptionList'
import { Popover } from './Popover'

/**
 * A text field completed from a list: the replacement for `<input list>` and a
 * `<datalist>`.
 *
 * Free text is always accepted, and every keystroke reaches `onChange` exactly as it
 * would from a plain input. The list only suggests: the registries are large and their
 * ids long, so a field that refused what it did not recognise would be unusable mid-word,
 * and existence is a validator's job, which warns rather than blocks.
 *
 * Opens on typing, on ArrowDown, or on a pointer press, and not on focus, so tabbing
 * through a form does not throw a list open over every field it passes. The list is
 * capped at `limit` options, and the footer says how many matched, so a registry of
 * 1333 items does not put 1333 buttons in the document on every keystroke.
 */
export function Combobox({
  id,
  value,
  options,
  onChange,
  limit = 50,
  placeholder,
  invalid,
  className = 'w-full max-w-md',
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
}: {
  id?: string
  value: string
  options: readonly ListOption[]
  onChange: (value: string) => void
  limit?: number
  placeholder?: string
  invalid?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}) {
  const listId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Filtering is on what was typed since the list opened, not on the value alone:
  // opening a field that already holds a full registry id should offer the list, not the
  // single option that matches it.
  const [query, setQuery] = useState('')

  const matches = useMemo(() => filterOptions(options, query), [options, query])
  const shown = matches.slice(0, limit)

  const close = useCallback(() => setOpen(false), [])
  const openList = (withQuery: string) => {
    setQuery(withQuery)
    setActive(-1)
    setOpen(true)
  }
  const pick = (option: ListOption) => {
    setOpen(false)
    input.current?.focus()
    onChange(option.value)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open) openList('')
        else setActive((i) => stepIndex(i, event.key === 'ArrowDown' ? 1 : -1, shown.length))
        return
      case 'Enter':
        if (!open) return
        event.preventDefault()
        if (shown[active]) pick(shown[active])
        else setOpen(false)
        return
      case 'Escape':
        if (!open) return
        event.preventDefault()
        // The editor overlay closes on Escape too. This one only meant "shut the list".
        event.stopPropagation()
        setOpen(false)
        return
      case 'Tab':
        setOpen(false)
    }
  }

  return (
    <div ref={wrapper} className={`relative flex ${className}`}>
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(listId, active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
          openList(event.target.value)
        }}
        onPointerDown={() => {
          if (!open) openList('')
        }}
        onKeyDown={onKeyDown}
        className={`${FIELD} w-full pr-7`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel ?? 'Field'}: show suggestions`}
        onClick={(event) => {
          event.preventDefault()
          if (open) setOpen(false)
          else openList('')
          input.current?.focus()
        }}
        className="text-text-muted hover:text-text-primary duration-fast absolute inset-y-0 right-0 flex items-center px-2 transition-colors motion-reduce:transition-none"
      >
        <Icon
          name="chevronDown"
          size="sm"
          className={`duration-fast transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <Popover container={wrapper} onDismiss={close}>
          {shown.length > 0 ? (
            <OptionList
              id={listId}
              options={shown}
              selected={value}
              active={active}
              onPick={pick}
              onHover={setActive}
              label={ariaLabel && `${ariaLabel} suggestions`}
            />
          ) : (
            <p className="text-text-muted px-2 py-1.5 text-xs">
              Nothing matches. What you typed is used as it is.
            </p>
          )}
          {matches.length > shown.length && (
            <p className="border-t-hairline border-border-subtle text-text-muted text-1xs mt-1 px-2 pt-1.5 pb-0.5">
              {`Showing ${shown.length} of ${matches.length}. Keep typing to narrow it.`}
            </p>
          )}
        </Popover>
      )}
    </div>
  )
}
