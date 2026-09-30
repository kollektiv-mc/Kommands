// aislop-ignore-file jsx-a11y/prefer-tag-over-role -- this file is the replacement for <select>, which the platform draws and no stylesheet reaches (see docs/design-tokens.md § Component patterns)
import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'
import { optionId, stepIndex, typeaheadIndex, type ListOption } from '../../lib/listbox'
import { FIELD } from '../editors/fieldStyles'
import { Icon } from './Icon'
import { OptionList } from './OptionList'
import { Popover } from './Popover'

const TYPEAHEAD_RESET_MS = 700

/**
 * A closed list: the replacement for a native `<select>`.
 *
 * The native one is drawn by the platform, which no stylesheet reaches. In the desktop
 * build's WebKitGTK view it opens as a white GTK list over a dark panel, which is why
 * Konnekt replaced its own (its issue 160), and it cannot be animated or given the suite's
 * surface anywhere.
 *
 * The keyboard contract is Konnekt's Combobox's in button mode, and a native select's:
 * arrows open and move (wrapping), Home and End jump, Enter or Space opens and picks,
 * Escape and Tab close, and typing jumps to the next option starting with what was
 * typed. The ARIA shape is the APG's select-only combobox: the button carries
 * `role="combobox"` and names the highlighted option through `aria-activedescendant`.
 */
export function Listbox<V extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = 'choose…',
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
}: {
  id?: string
  value: V | ''
  options: readonly ListOption<V>[]
  onChange: (value: V) => void
  /** Shown when `value` matches no option. */
  placeholder?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}) {
  const listId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const typed = useRef({ buffer: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const selected = options.find((o) => o.value === value)

  const close = useCallback(() => setOpen(false), [])
  const openList = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    )
    setOpen(true)
  }
  const pick = (option: ListOption<V>) => {
    setOpen(false)
    trigger.current?.focus()
    if (option.value !== value) onChange(option.value)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open) openList()
        else setActive((i) => stepIndex(i, event.key === 'ArrowDown' ? 1 : -1, options.length))
        return
      case 'Home':
      case 'End':
        if (!open) return
        event.preventDefault()
        setActive(event.key === 'Home' ? 0 : options.length - 1)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!open) openList()
        else if (options[active]) pick(options[active])
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
        return
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return
    const now = Date.now()
    const buffer =
      now - typed.current.at > TYPEAHEAD_RESET_MS ? event.key : typed.current.buffer + event.key
    typed.current = { buffer, at: now }
    const current = open ? active : options.findIndex((o) => o.value === value)
    // A new letter, or the same one pressed again, searches from the option after the
    // current one; a word being typed keeps matching from where it already is.
    const repeating = [...buffer].every((c) => c === buffer[0])
    const hit = typeaheadIndex(options, buffer, repeating ? current + 1 : Math.max(current, 0))
    if (hit < 0) return
    event.preventDefault()
    if (open) setActive(hit)
    else onChange(options[hit]!.value)
  }

  return (
    <div ref={wrapper} className={`relative inline-flex ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(listId, active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onClick={(event) => {
          // Cancelled for the same reason as an option's click: see OptionList.
          event.preventDefault()
          if (open) setOpen(false)
          else openList()
        }}
        onKeyDown={onKeyDown}
        className={`${FIELD} flex w-full cursor-pointer items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected ? '' : 'text-text-faint'}`}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevronDown"
          size="sm"
          className={`text-text-muted duration-fast transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <Popover container={wrapper} onDismiss={close}>
          <OptionList
            id={listId}
            options={options}
            selected={value}
            active={active}
            onPick={pick}
            onHover={setActive}
            label={ariaLabel && `${ariaLabel} options`}
          />
        </Popover>
      )}
    </div>
  )
}
