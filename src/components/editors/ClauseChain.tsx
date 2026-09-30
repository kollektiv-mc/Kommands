import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { InstanceId, Path } from '../../schema/paths'
import { moveTo } from '../../lib/reorder'
import { useReorderFlip } from '../../lib/useReorderFlip'
import { useLit, useOutputHover } from '../../stores/useOutputHover'
import { Collapsible } from '../ui/Collapsible'
import { Icon } from '../ui/Icon'
import { MenuButton, type MenuItem } from '../ui/MenuButton'
import { FOCUS, HELP } from './fieldStyles'

/**
 * A Repeat, drawn as a numbered chain of steps: `/execute`'s clauses.
 *
 * **Lazy**: `CommandRenderer` reaches it through `React.lazy`, because a Repeat appears
 * in a minority of definitions and `/give` should not pay for `/execute`'s editor.
 *
 * It renders no clause itself. `renderClause` hands back the subtree, so this file
 * imports nothing from `CommandRenderer` and the two cannot form a cycle, and the walk
 * stays in one place rather than forking a second one here. Nor does it know which
 * command it is drawing: the step kinds, their help and their groups come in as data
 * from the definition's `ui.clauses`, and the last step (`run`) is whatever Choice the
 * renderer found after the Repeat by its shape.
 *
 * Each step says what it is once, in its header, as the keyword the output shows, with
 * what it writes beside it; the form under it holds only what is left to fill. It
 * used to say "as" three times: the card title, a picker, and grey text by the field.
 *
 * **What it deliberately is not.** Konnekt's scheduler is the obvious reference and
 * most of it does not apply: that is a free-form graph with persisted positions, typed
 * ports and edges. A chain whose order *is* its structure needs none of them. Position
 * is the index, and there are no edges to store because the sequence is the edge.
 */

/** A kind of step the add menu offers: a branch of the Repeat's Choice. */
export interface StepKind {
  branch: number
  label: string
  help?: string
  group?: string
}

/** What a step is called, what it writes, and which output pieces are its. */
export interface StepNaming {
  label: string
  help?: string
  /** The step's own text in the command, without its keyword: `@a[tag=boss]` after `as`. */
  summary: string
  /** The path `Segment.field` names for this step's keyword, for hover linking. */
  field: Path
}

export interface ClauseChainProps {
  /** The instances, in order. The order of this list is the order of the steps. */
  ids: readonly InstanceId[]
  /** Below this many steps, removal is not offered. */
  min: number
  /** At this many, adding is not offered. Undefined means no ceiling. */
  max?: number
  naming: (id: InstanceId) => StepNaming
  /**
   * The kinds of step there are, in the order the add menu lists them. Empty for a
   * Repeat of something other than a Choice, whose add button adds one plain instance.
   */
  kinds: readonly StepKind[]
  /** The step's own editors. Rendered by the caller's walk, not by this file. */
  renderClause: (id: InstanceId) => ReactNode
  /**
   * Hand back a new ordering, with `gesture` naming the drag it came from, so the store
   * can make one undo step of a drag that crossed three cards. A click passes none.
   */
  onReorder: (ids: readonly InstanceId[], gesture?: string) => void
  /** Add a step at `at`, of the kind `branch` names when there are kinds. */
  onAdd: (at: number, branch?: number) => void
  /** The step that ends the chain (`run`), drawn after the rest and never moved. */
  tail?: StepNaming & { body: ReactNode }
}

export default function ClauseChain({
  ids,
  min,
  max,
  naming,
  kinds,
  renderClause,
  onReorder,
  onAdd,
  tail,
}: ClauseChainProps) {
  /**
   * The step the user last moved or picked up, so that after dragging the sixth step
   * up to second it is still plain which one it is. Keyed by instance id, so it follows
   * the step through any reordering with no work at all.
   */
  const [marked, setMarked] = useState<InstanceId | null>(null)
  const [dragging, setDragging] = useState<InstanceId | null>(null)
  /** Collapsed steps, by id. Local: folding a step is a view of it, not a value. */
  const [folded, setFolded] = useState<ReadonlySet<InstanceId>>(new Set())
  /** The steps there when the chain mounted. Only steps added later fade in. */
  const [present] = useState(() => new Set(ids))
  const flip = useReorderFlip(ids, dragging)

  /**
   * Names the drag in progress, so its reorders coalesce into one undo step. A counter
   * rather than the dragged id: dragging the same step twice in a row is two steps.
   */
  const gesture = useRef(0)

  const count = ids.length
  const atMax = max !== undefined && count >= max
  const canRemove = count > min

  /** Which slot the pointer is over, by step midpoint. */
  const slotAt = useCallback((clientY: number, cards: HTMLElement[]): number => {
    let slot = 0
    cards.forEach((card, index) => {
      const box = card.getBoundingClientRect()
      if (clientY > box.top + box.height / 2) slot = index
    })
    return slot
  }, [])

  const list = useRef<HTMLOListElement>(null)

  const reorder = (next: readonly InstanceId[], tag?: string) => {
    flip.capture()
    if (tag === undefined) onReorder(next)
    else onReorder(next, tag)
  }

  const move = (id: InstanceId, by: number) => {
    const from = ids.indexOf(id)
    const next = moveTo(ids, from, from + by)
    // `moveTo` hands back the same array when the move goes nowhere, and a reorder that
    // changes nothing would still push an undo step that appears to do nothing.
    if (next === ids) return
    setMarked(id)
    reorder(next)
  }

  const remove = (id: InstanceId) => {
    if (marked === id) setMarked(null)
    reorder(ids.filter((held) => held !== id))
  }

  const add = (at: number, branch?: number) => {
    flip.capture()
    onAdd(at, branch)
  }

  const addItems = (at: number): MenuItem[] =>
    kinds.map((kind) => ({
      key: String(kind.branch),
      label: kind.label,
      description: kind.help,
      group: kind.group,
      onSelect: () => add(at, kind.branch),
    }))

  const startDrag = (id: InstanceId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Captured on the handle, so the gesture survives the pointer leaving it.
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current += 1
    setDragging(id)
    setMarked(id)
  }

  const moveDrag = (id: InstanceId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging !== id || !list.current) return
    const cards = [...list.current.querySelectorAll<HTMLElement>(':scope > [data-step]')]
    const from = ids.indexOf(id)
    const to = slotAt(event.clientY, cards)
    if (from !== to) reorder(moveTo(ids, from, to), `drag:${gesture.current}`)
  }

  const endDrag = () => setDragging(null)

  /** Arrow keys on the handle move the step, so reordering never needs a pointer. */
  const onHandleKey = (id: InstanceId) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    move(id, event.key === 'ArrowUp' ? -1 : 1)
  }

  const toggleFold = (id: InstanceId) =>
    setFolded((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col">
      <ol ref={list} className="relative flex list-none flex-col">
        {ids.map((id, index) => {
          const step = naming(id)
          const n = index + 1
          const open = !folded.has(id)
          return (
            // Keyed on the instance's id, never its position: with `key={index}` a
            // reorder hands each mounted editor the next step's props, and a picker's
            // local state stays on the step that did not move.
            <li
              key={id}
              data-step={id}
              ref={(element) => flip.register(id, element)}
              className={`group/step relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-3 ${present.has(id) ? '' : 'content-in'} ${dragging === id ? 'z-10' : ''}`}
            >
              <Rail>{n}</Rail>
              <StepCard
                label={step.label}
                name={`Step ${n}, ${step.label}`}
                summary={step.summary}
                field={step.field}
                emphasis={marked === id || dragging === id}
                handle={
                  // A real button, not a div with a pointer handler: it carries the
                  // drag, and being focusable is what lets the arrow keys reach it.
                  // `touch-none`, or a touch drag scrolls the page instead.
                  <button
                    type="button"
                    className={`${FOCUS} text-text-faint hover:text-text-secondary hover:bg-hover flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded`}
                    aria-label={`Reorder step ${n}`}
                    title="Drag, or use the arrow keys, to reorder"
                    onPointerDown={startDrag(id)}
                    onPointerMove={moveDrag(id)}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onHandleKey(id)}
                  >
                    <Icon name="grip" size="sm" />
                  </button>
                }
                actions={
                  <>
                    <StepAction
                      label={`Move step ${n} earlier`}
                      icon="chevronUp"
                      disabled={index === 0}
                      onClick={() => move(id, -1)}
                    />
                    <StepAction
                      label={`Move step ${n} later`}
                      icon="chevronDown"
                      disabled={index === count - 1}
                      onClick={() => move(id, 1)}
                    />
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} step ${n}`}
                      title={open ? 'Collapse' : 'Expand'}
                      onClick={() => toggleFold(id)}
                      className={`${FOCUS} text-text-faint hover:text-text-primary hover:bg-hover flex h-7 w-7 items-center justify-center rounded`}
                    >
                      <Icon
                        name="chevronDown"
                        size="sm"
                        className={`duration-panel transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
                      />
                    </button>
                    {canRemove && (
                      <StepAction
                        label={`Remove step ${n}`}
                        icon="close"
                        danger
                        onClick={() => remove(id)}
                      />
                    )}
                  </>
                }
              >
                <Collapsible open={open}>
                  <div className="flex flex-col gap-1 pb-2">
                    {step.help && <p className={`${HELP} px-3`}>{step.help}</p>}
                    {renderClause(id)}
                  </div>
                </Collapsible>
              </StepCard>
              {/* A step can go between any two, not only at the end. */}
              {!atMax && kinds.length > 0 && index < count - 1 && (
                <div className="absolute -bottom-2 left-0.5 z-10 opacity-0 transition-opacity group-hover/step:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
                  <MenuButton
                    label={`Insert a step after step ${n}`}
                    icon="plus"
                    iconOnly
                    keywords
                    items={addItems(index + 1)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {/* Hidden at `max` rather than disabled: the limit is a fact about the command's
          grammar, so the control that would break it is not offered. */}
      {!atMax && (
        <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-3">
          <Rail dashed>
            <Icon name="plus" size="sm" />
          </Rail>
          <div className="flex items-center pt-1">
            {kinds.length > 0 ? (
              <MenuButton label="Add a step" icon="plus" keywords items={addItems(count)} />
            ) : (
              <button
                type="button"
                onClick={() => add(count)}
                className={`${FOCUS} text-accent hover:bg-accent/10 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium`}
              >
                <Icon name="plus" size="sm" />
                Add a step
              </button>
            )}
          </div>
        </div>
      )}
      {tail && (
        <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
          <Rail last>
            <Icon name="play" size="sm" />
          </Rail>
          <StepCard
            label={tail.label}
            name={`Last step, ${tail.label}`}
            summary={tail.summary}
            field={tail.field}
            emphasis={false}
            actions={<span className="text-text-muted text-1xs px-2">Last step</span>}
          >
            <div className="flex flex-col gap-1 pb-2">
              {tail.help && <p className={`${HELP} px-3`}>{tail.help}</p>}
              {tail.body}
            </div>
          </StepCard>
        </div>
      )}
    </div>
  )
}

/**
 * The number beside a step, on the line that joins it to the next. The line is a
 * hairline, the width every other rule here is drawn at.
 */
function Rail({
  children,
  dashed = false,
  last = false,
}: {
  children: ReactNode
  dashed?: boolean
  last?: boolean
}) {
  const tone = last
    ? 'bg-accent/15 text-accent border-accent/45'
    : dashed
      ? 'bg-canvas text-text-muted border-border-hover border-dashed'
      : 'bg-elevated text-text-secondary border-border-hover group-hover/step:text-text-primary group-hover/step:border-text-faint'
  return (
    <div aria-hidden="true" className="flex flex-col items-center">
      <span
        className={`border-hairline text-1xs duration-fast mt-2 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full font-mono font-semibold tabular-nums transition-colors motion-reduce:transition-none ${tone}`}
      >
        {children}
      </span>
      {!last && !dashed && (
        <span className="border-l-hairline border-border-hover mt-1 -mb-5 flex-1" />
      )}
    </div>
  )
}

/**
 * A step's card: its keyword, what it writes, its controls, and its form.
 *
 * Hovering the header lights the step's keyword in the output, and hovering that
 * keyword outlines this card, through the same store the form's rows use.
 */
function StepCard({
  label,
  name,
  summary,
  field,
  emphasis,
  handle,
  actions,
  children,
}: {
  label: string
  /** The card's accessible name, which says "step" as the visible numbering does. */
  name: string
  summary: string
  field: Path
  emphasis: boolean
  handle?: ReactNode
  actions: ReactNode
  children: ReactNode
}) {
  const lit = useLit(field)
  const hover = useOutputHover((s) => s.hover)
  const border = emphasis ? 'border-accent' : lit ? 'border-accent/60' : 'border-border-subtle'
  return (
    <section
      aria-label={name}
      className={`group/card border-hairline bg-elevated rounded-panel duration-fast hover:border-text-faint min-w-0 transition-colors motion-reduce:transition-none ${border}`}
    >
      <div
        className="flex min-h-11 items-center gap-2 py-1.5 pr-1.5 pl-1"
        onPointerEnter={() => hover(field)}
        onPointerLeave={() => hover(null)}
      >
        {handle}
        <span className="text-accent bg-accent/15 shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold">
          {label}
        </span>
        <code className="text-text-secondary min-w-0 flex-1 truncate font-mono text-xs">
          {summary}
        </code>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</span>
      </div>
      {children}
    </section>
  )
}

/**
 * A step's move and remove buttons: quiet until the card is hovered or holds focus, so
 * a long chain reads as its keywords rather than as rows of controls. Always shown
 * where there is no hover (a touch screen), since there they could not be found.
 */
function StepAction({
  label,
  icon,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string
  icon: 'chevronUp' | 'chevronDown' | 'close'
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`${FOCUS} text-text-faint hover:bg-hover duration-fast flex h-7 w-7 items-center justify-center rounded opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100 disabled:cursor-not-allowed disabled:group-hover/card:opacity-30 motion-reduce:transition-none pointer-coarse:opacity-100 ${danger ? 'hover:text-danger' : 'hover:text-text-primary'}`}
    >
      <Icon name={icon} size="sm" />
    </button>
  )
}
