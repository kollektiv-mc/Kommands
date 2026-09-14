import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { InstanceId } from '../../schema/paths'
import { moveTo } from '../../lib/reorder'
import { Icon } from '../ui/Icon'
import { ROW_ADD } from './rowStyles'
/**
 * A Repeat, drawn as a chain of nodes.
 *
 * This is the editor `/execute`'s clause chain was always meant to have, replacing the
 * stack of rows that proved the data layer (#34). It is **lazy**: `CommandRenderer`
 * reaches it through `React.lazy`, because a Repeat appears in a minority of
 * definitions and the entry chunk had 3.3 KB of headroom against its 120 KB budget
 * when this landed. `/give` should not pay for `/execute`'s editor.
 *
 * It renders no clause itself. `renderClause` hands back the subtree, so this file
 * imports nothing from `CommandRenderer` and the two cannot form a cycle - which is
 * also what keeps the walk in one place rather than forking a second one here.
 *
 * **What it deliberately is not.** Konnekt's scheduler is the obvious reference and
 * most of it does not apply: that is a free-form graph with persisted `x`/`y`, typed
 * ports, an edge model and cycle detection. A chain whose order *is* its structure
 * needs none of them. Position is the index, and there are no edges to store because
 * the sequence is the edge. If free positioning is ever wanted, that is a different
 * feature and not a wider version of this one - the value tree holds command values
 * only, and layout in there would serialize into a command.
 */

export interface ClauseChainProps {
  /** The instances, in order. The order of this list is the order of the clauses. */
  ids: readonly InstanceId[]
  /** Below this many clauses, removal is not offered. */
  min: number
  /** At this many, adding is not offered. Undefined means no ceiling. */
  max?: number
  /**
   * What this clause is called and what it does, as its chosen branch currently reads.
   *
   * One callback rather than a `label` and a `help` prop, because both answers come
   * from resolving the same branch and splitting them would resolve it twice per
   * clause per render.
   */
  naming: (id: InstanceId) => { label: string; help?: string }
  /** The clause's own editors. Rendered by the caller's walk, not by this file. */
  renderClause: (id: InstanceId) => ReactNode
  /**
   * Hand back a new ordering, with `gesture` naming the drag it came from.
   *
   * A pointer crossing three card midpoints reorders three times, and all three are
   * one thing the user did. The tag is what lets the store collapse them into one undo
   * step; a click on a move control passes none, because one click is one step.
   */
  onReorder: (ids: readonly InstanceId[], gesture?: string) => void
  onAdd: () => void
}

export default function ClauseChain({
  ids,
  min,
  max,
  naming,
  renderClause,
  onReorder,
  onAdd,
}: ClauseChainProps) {
  /**
   * The clause the user last moved or picked up.
   *
   * Keyed by instance id, which is what makes it free: ids are stable identities
   * (#33), so a permutation moves the clause and the mark follows it with no work at
   * all. Keyed by index it would have to be permuted alongside the values, and getting
   * that subtly wrong is how a highlight ends up on the clause that did not move.
   *
   * It answers one question, and the question is real: after dragging the sixth clause
   * up to second, which one is it now? In a chain of eight otherwise similar rows that
   * is genuinely hard to see.
   */
  const [marked, setMarked] = useState<InstanceId | null>(null)
  const [dragging, setDragging] = useState<InstanceId | null>(null)
  const cards = useRef(new Map<InstanceId, HTMLElement>())

  /**
   * Names the drag currently in progress, so its reorders coalesce into one undo step.
   *
   * A counter rather than the dragged id: dragging the same clause twice in a row has
   * to be two steps, and an id-derived tag would make it one. The caller qualifies this
   * with the Repeat's path before it reaches the store, since two chains on one page
   * each count from zero.
   */
  const gesture = useRef(0)

  const count = ids.length
  const atMax = max !== undefined && count >= max
  const canRemove = count > min

  const register = useCallback((id: InstanceId, element: HTMLElement | null) => {
    if (element === null) cards.current.delete(id)
    else cards.current.set(id, element)
  }, [])

  /** Which slot the pointer is currently over, by card midpoint. */
  const slotAt = useCallback(
    (clientY: number): number => {
      let slot = 0
      ids.forEach((id, index) => {
        const card = cards.current.get(id)
        if (card === undefined) return
        const box = card.getBoundingClientRect()
        if (clientY > box.top + box.height / 2) slot = index
      })
      return slot
    },
    [ids],
  )

  const startDrag = (id: InstanceId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Captured on the handle, so the gesture survives the pointer leaving it. Without
    // this a drag ends the moment the cursor outruns a 24px button, which at any real
    // speed is immediately.
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current += 1
    setDragging(id)
    setMarked(id)
  }

  const moveDrag = (id: InstanceId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging !== id) return
    const from = ids.indexOf(id)
    const to = slotAt(event.clientY)
    if (from !== to) onReorder(moveTo(ids, from, to), `drag:${gesture.current}`)
  }

  const endDrag = () => setDragging(null)

  const move = (id: InstanceId, by: number) => {
    const from = ids.indexOf(id)
    const next = moveTo(ids, from, from + by)
    // `moveTo` hands back the same array when the move goes nowhere, and a reorder
    // that changes nothing would still push an undo step. The buttons at the ends of
    // the chain are disabled, so this is not reachable from the UI today - but that
    // makes the disabled attribute the only thing standing between a user and an undo
    // that appears to do nothing, which is too much weight for it to carry.
    if (next === ids) return
    setMarked(id)
    onReorder(next)
  }

  const remove = (id: InstanceId) => {
    if (marked === id) setMarked(null)
    onReorder(ids.filter((held) => held !== id))
  }

  return (
    <div className="flex flex-col gap-1">
      <ol className="flex list-none flex-col gap-1">
        {ids.map((id, index) => {
          const { label, help } = naming(id)
          return (
            // Keyed on the instance's id, never its position. With `key={index}` React
            // sees the same keys in the same order after a reorder and hands each
            // mounted editor the next clause's props: values move and component-internal
            // state does not, so a dropdown's selection stays on the clause that did not.
            <li key={id} ref={(element) => register(id, element)}>
              <div
                className={
                  'border-hairline bg-elevated rounded-panel flex flex-col gap-2 p-2 ' +
                  (marked === id ? 'border-accent' : 'border-border-subtle') +
                  (dragging === id ? ' opacity-60' : '')
                }
              >
                <div className="flex items-center gap-2">
                  {/*
                    The handle is a real button, not a div with a pointer handler. It
                    carries the drag, and being focusable is what lets the keyboard
                    controls beside it be reached at all.
                    `touch-none` because a touch drag would otherwise scroll the page
                    instead of moving the clause: the browser claims the gesture for
                    panning before the pointer handler sees the second event.
                  */}
                  <button
                    type="button"
                    className="text-text-faint hover:text-text-primary cursor-grab touch-none"
                    aria-label={`Reorder clause ${index + 1}`}
                    onPointerDown={startDrag(id)}
                    onPointerMove={moveDrag(id)}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <Icon name="grip" size="sm" />
                  </button>
                  <span className="text-text-faint text-3xs w-4 text-right font-mono">
                    {index + 1}
                  </span>
                  <span className="text-text-primary text-1xs min-w-0 flex-1 truncate font-mono">
                    {label}
                  </span>
                  {/*
                    Kept as buttons with the accessible names the rows used, and that is
                    not the placeholder surviving. Dragging is a pointer gesture, so
                    without these the only way to reorder a chain needs a mouse - and
                    the aislop gate already counts eleven jsx-a11y findings against a
                    ratchet this must not push further. The names are good names for the
                    operations, so changing them would cost the keyboard path its
                    clarity to prove a point about the rewrite.
                  */}
                  <button
                    type="button"
                    className={ROW_REMOVE_DISABLED}
                    aria-label={`Move clause ${index + 1} earlier`}
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                  >
                    <Icon name="chevronUp" size="sm" />
                  </button>
                  <button
                    type="button"
                    className={ROW_REMOVE_DISABLED}
                    aria-label={`Move clause ${index + 1} later`}
                    disabled={index === count - 1}
                    onClick={() => move(id, 1)}
                  >
                    <Icon name="chevronDown" size="sm" />
                  </button>
                  {canRemove && (
                    <button
                      type="button"
                      className="text-text-faint hover:text-danger"
                      aria-label={`Remove clause ${index + 1}`}
                      onClick={() => remove(id)}
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  )}
                </div>
                {help !== undefined && <span className="text-text-faint text-3xs">{help}</span>}
                <div className="border-t-hairline border-border-subtle pt-2">
                  {renderClause(id)}
                </div>
              </div>
              {/* The link to the next node. Drawn between cards rather than on one, so
                  the last clause does not trail a connector into empty space. */}
              {index < count - 1 && (
                <div aria-hidden="true" className="flex justify-center">
                  {/* A hairline border rather than a 1px block: 0.5px is the width
                      every other rule in this app is drawn at, and `w-px` would be the
                      one line in the chain that is twice as heavy as the card it
                      joins. */}
                  <span className="border-l-hairline border-border-subtle h-2" />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {/* Hidden at `max` rather than disabled, matching how removal treats `min`. The
          limit is a fact about the command's grammar, so the control that would break
          it is not offered. */}
      {!atMax && (
        <div className="flex">
          <button
            type="button"
            className={ROW_ADD}
            // Labelled like its siblings, which say "Move clause 1 earlier" and
            // "Remove clause 1". The visible text is ambiguous on its own: a deep
            // editor inside a clause may carry a `+ add` of its own, and
            // `item_stack`'s does.
            aria-label="Add clause"
            onClick={onAdd}
          >
            + add
          </button>
        </div>
      )}
    </div>
  )
}
/** Muted, and visibly inert at the ends of the chain where the move is not available. */
const ROW_REMOVE_DISABLED =
  'text-text-faint hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30'
