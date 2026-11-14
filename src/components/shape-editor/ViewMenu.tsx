import { useCallback, useEffect, useRef, useState } from 'react'
import { useShapeEditorStore, type ViewOptions } from '../../stores/useShapeEditorStore'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Popover } from '../ui/Popover'
import { EYEBROW, SEG, SEG_BUTTON } from './styles'

type Choice<K extends keyof ViewOptions> = readonly (readonly [ViewOptions[K], string])[]

const SHOW: Choice<'show'> = [
  ['blocks', 'Blocks'],
  ['shapes', 'Shapes'],
]
const SHADING: Choice<'shading'> = [
  ['coloured', 'Coloured'],
  ['solid', 'Solid'],
  ['wire', 'Wireframe'],
]
const TOGGLES = [
  ['cutaway', 'Cutaway'],
  ['xray', 'X-ray'],
  ['bounds', 'Selection box'],
  ['grid', 'Grid'],
  ['axes', 'Axes'],
  ['player', 'Player'],
] as const

/**
 * What the view draws: the blocks or the shapes, how they are shaded, and the aids
 * around them. It stays open while things are toggled, so several can be changed in a
 * row; a press outside or Escape closes it.
 */
export function ViewMenu() {
  const view = useShapeEditorStore((s) => s.view)
  const setView = useShapeEditorStore((s) => s.setView)
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }, [])
  const dismiss = useCallback(() => setOpen(false), [])

  // Escape closes the menu and nothing else, so it is taken before the editor hears it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])

  return (
    <div ref={wrapper} className={SEG}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${SEG_BUTTON} ${FOCUS}`}
      >
        View
        <Icon
          name="chevronDown"
          size="xs"
          className={`text-text-muted duration-fast transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <Popover container={wrapper} onDismiss={dismiss} align="end" className="w-59 p-1">
          <Chips
            title="Show"
            options={SHOW}
            value={view.show}
            onPick={(show) => setView({ show })}
          />
          <Chips
            title="Shading"
            options={SHADING}
            value={view.shading}
            onPick={(shading) => setView({ shading })}
          />
          <div className="border-t-hairline border-border-subtle mx-1 my-1" />
          {TOGGLES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view[key]}
              onClick={() => setView({ [key]: !view[key] })}
              className={`text-text-primary hover:bg-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs ${FOCUS}`}
            >
              <Icon
                name="check"
                size="xs"
                className={`text-accent ${view[key] ? '' : 'opacity-0'}`}
              />
              {label}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}

function Chips<V extends string>({
  title,
  options,
  value,
  onPick,
}: {
  title: string
  options: readonly (readonly [V, string])[]
  value: V
  onPick: (value: V) => void
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
            onClick={() => onPick(v)}
            className={`${SEG_BUTTON} flex-1 justify-center ${FOCUS}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
