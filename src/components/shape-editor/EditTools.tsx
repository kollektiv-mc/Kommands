import { useShapeEditorStore, type EditOptions } from '../../stores/useShapeEditorStore'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Popover } from '../ui/Popover'
import { SEG, SEG_BUTTON } from './styles'
import { Chips } from './Chips'
import { useToolbarMenu } from './useToolbarMenu'

type Choice<K extends keyof EditOptions> = readonly (readonly [EditOptions[K], string])[]

const MODES: readonly (readonly [EditOptions['mode'], string, string])[] = [
  ['translate', 'Move', 'W'],
  ['rotate', 'Rotate', 'E'],
  ['scale', 'Scale', 'R'],
]
const SNAP_TO: Choice<'snapTo'> = [
  ['grid', 'Grid'],
  ['blocks', 'Blocks'],
]
const MOVE: Choice<'move'> = [
  [0.01, '0.01'],
  [0.05, '0.05'],
  [0.1, '0.1'],
  [0.25, '0.25'],
]
const TURN: Choice<'turn'> = [
  [5, '5°'],
  [15, '15°'],
  [45, '45°'],
  [90, '90°'],
]
const SCALE: Choice<'scale'> = [
  [0.05, '0.05'],
  [0.1, '0.1'],
  [0.25, '0.25'],
]

/** A key named on its button: quiet, and the accent while the button is pressed. */
function Key({ children }: { children: string }) {
  return (
    <kbd className="text-text-faint group-aria-pressed:text-accent text-2xs font-mono font-medium">
      {children}
    </kbd>
  )
}

/**
 * View and Edit, and in Edit the gizmo's mode and snapping.
 *
 * View orbits and selects; Edit puts the move, rotate and scale gizmo on the selected
 * layer. Enter and Escape switch between them, and W, E and R pick the gizmo.
 */
export function EditTools() {
  const edit = useShapeEditorStore((s) => s.edit)
  const setEdit = useShapeEditorStore((s) => s.setEdit)
  return (
    <>
      {/* aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- a segmented control, as the View menu's rows are */}
      <div role="group" aria-label="Mode" className={SEG}>
        <button
          type="button"
          aria-pressed={!edit.on}
          onClick={() => setEdit({ on: false })}
          className={`${SEG_BUTTON} group ${FOCUS}`}
        >
          View <Key>Esc</Key>
        </button>
        <button
          type="button"
          aria-pressed={edit.on}
          onClick={() => setEdit({ on: true })}
          className={`${SEG_BUTTON} group ${FOCUS}`}
        >
          Edit <Key>Enter</Key>
        </button>
      </div>
      {edit.on && (
        <>
          {/* aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- a segmented control, as above */}
          <div role="group" aria-label="Gizmo" className={SEG}>
            {MODES.map(([mode, label, key]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={edit.mode === mode}
                onClick={() => setEdit({ mode })}
                className={`${SEG_BUTTON} group ${FOCUS}`}
              >
                {label} <Key>{key}</Key>
              </button>
            ))}
          </div>
          <SnapButton />
        </>
      )}
    </>
  )
}

/** Snap on or off, and beside it a menu of what it snaps to and by how much. */
function SnapButton() {
  const edit = useShapeEditorStore((s) => s.edit)
  const setEdit = useShapeEditorStore((s) => s.setEdit)
  const { open, toggle, dismiss, wrapper, trigger } = useToolbarMenu()
  // Picking a step means snapping by it, so it turns Snap on.
  const pick = (change: Partial<EditOptions>) => setEdit({ ...change, snap: true })
  return (
    <div ref={wrapper} className={`${SEG} gap-0`}>
      <button
        ref={trigger}
        type="button"
        aria-label="Snap settings"
        aria-expanded={open}
        onClick={toggle}
        className={`${SEG_BUTTON} rounded-r-none px-1 ${FOCUS}`}
      >
        <Icon
          name="chevronDown"
          size="xs"
          className={`text-text-muted duration-fast transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <button
        type="button"
        aria-pressed={edit.snap}
        onClick={() => setEdit({ snap: !edit.snap })}
        className={`${SEG_BUTTON} rounded-l-none ${FOCUS}`}
      >
        Snap
      </button>
      {open && (
        <Popover container={wrapper} onDismiss={dismiss} className="w-59 p-1">
          <Chips
            title="Snap to"
            options={SNAP_TO}
            value={edit.snapTo}
            onPick={(snapTo) => pick({ snapTo })}
          />
          <Chips
            title="Move"
            options={MOVE}
            value={edit.move}
            disabled={edit.snapTo === 'blocks'}
            onPick={(move) => pick({ move })}
          />
          <Chips
            title="Rotate"
            options={TURN}
            value={edit.turn}
            onPick={(turn) => pick({ turn })}
          />
          <Chips
            title="Scale"
            options={SCALE}
            value={edit.scale}
            onPick={(scale) => pick({ scale })}
          />
        </Popover>
      )}
    </div>
  )
}
