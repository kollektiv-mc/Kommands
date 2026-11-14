import { useShapeEditorStore, type ViewOptions } from '../../stores/useShapeEditorStore'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Popover } from '../ui/Popover'
import { SEG, SEG_BUTTON } from './styles'
import { Chips } from './Chips'
import { useToolbarMenu } from './useToolbarMenu'

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

/** What the view draws: the blocks or the shapes, how they are shaded, and the aids around them. */
export function ViewMenu() {
  const view = useShapeEditorStore((s) => s.view)
  const setView = useShapeEditorStore((s) => s.setView)
  const { open, toggle, dismiss, wrapper, trigger } = useToolbarMenu()

  return (
    <div ref={wrapper} className={SEG}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        onClick={toggle}
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
