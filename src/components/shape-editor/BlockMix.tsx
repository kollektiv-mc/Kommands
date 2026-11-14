import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { parsePattern } from '../../schema/argument-types/we-pattern'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { addRow, chanceText, readMix, writeMix, type MixRow } from './mix'
import { bareId, blockCss } from './swatch'

/** Swatches shown before the rest are counted. */
const SWATCHES = 4

/**
 * The Blocks field: the pattern as text, a button that opens it as a list (the block
 * mix), and a swatch per block. Every edit while it has the keyboard or the mix is open
 * is one undo step.
 */
export function BlocksField() {
  const pattern = useShapeEditorStore((s) => s.pattern)
  const setPattern = useShapeEditorStore((s) => s.setPattern)
  const settle = useShapeEditorStore((s) => s.settle)
  const [open, setOpen] = useState(false)
  const field = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false)
      settle()
      if (refocus) button.current?.focus({ preventScroll: true })
    },
    [settle],
  )

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-text-secondary text-xs font-semibold">
        Blocks
      </label>
      <div
        ref={field}
        className="border-hairline border-border-hover bg-canvas focus-within:border-accent flex h-7 w-40 items-stretch rounded-md"
      >
        <input
          id={id}
          value={pattern}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setPattern(e.currentTarget.value, 'pattern')}
          onBlur={settle}
          onKeyDown={(e) => e.stopPropagation()}
          className="text-text-primary min-w-0 flex-1 bg-transparent px-2.5 font-mono text-xs outline-none"
        />
        <Tooltip label="Block mix">
          <button
            ref={button}
            type="button"
            aria-label="Block mix"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => (open ? close(false) : setOpen(true))}
            className={`border-l-hairline border-border-subtle text-text-muted hover:text-text-primary hover:bg-hover aria-expanded:bg-hover aria-expanded:text-text-primary grid w-6 place-items-center rounded-r-md ${FOCUS}`}
          >
            <Icon name={open ? 'chevronDown' : 'chevronUp'} size="xs" />
          </button>
        </Tooltip>
      </div>
      <Swatches pattern={pattern} />
      {open && <BlockMix anchor={field} toggle={button} onClose={close} />}
    </div>
  )
}

/** A swatch per block, the first few, then a count of the rest. */
function Swatches({ pattern }: { pattern: string }) {
  const blocks = parsePattern(pattern)
    .entries.map((e) => bareId(e.block))
    .filter((b) => b !== '')
  const shown = blocks.length > SWATCHES + 1 ? blocks.slice(0, SWATCHES) : blocks
  return (
    <span aria-hidden="true" className="flex items-center gap-0.5">
      {shown.map((block, i) => (
        <i
          key={`${i} ${block}`}
          // eslint-disable-next-line no-restricted-syntax -- a block's colour, from data at runtime
          style={{ background: blockCss(block) }}
          className="border-hairline border-border-hover block size-3 rounded-sm"
        />
      ))}
      {blocks.length > shown.length && (
        <span className="text-text-muted text-2xs pl-1 font-mono">
          +{blocks.length - shown.length}
        </span>
      )}
    </span>
  )
}

/**
 * The mix, above the Blocks field: a row per block with its chance, Add block under
 * them. A press anywhere else or Escape closes it.
 */
function BlockMix({
  anchor,
  toggle,
  onClose,
}: {
  anchor: RefObject<HTMLElement | null>
  toggle: RefObject<HTMLElement | null>
  onClose: (refocus: boolean) => void
}) {
  const setPattern = useShapeEditorStore((s) => s.setPattern)
  const [rows, setRows] = useState(() => readMix(useShapeEditorStore.getState().pattern))
  const panel = useRef<HTMLDivElement>(null)
  const added = useRef(false)

  const write = (next: MixRow[]) => {
    setRows(next)
    setPattern(writeMix(next), 'pattern')
  }
  const change = (key: number, patch: Partial<MixRow>) =>
    write(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  useLayoutEffect(() => {
    const el = panel.current
    const at = anchor.current?.getBoundingClientRect()
    if (!el || !at) return
    const gap = parseFloat(getComputedStyle(el).getPropertyValue('--popover-gap')) || 0
    const left = Math.max(gap * 2, Math.min(at.left, window.innerWidth - el.offsetWidth - gap * 2))
    el.style.left = `${left}px`
    el.style.bottom = `${window.innerHeight - at.top + gap}px`
  }, [anchor])

  // The new row's block field takes the keyboard once it is drawn.
  useEffect(() => {
    if (!added.current) return
    added.current = false
    const names = panel.current?.querySelectorAll<HTMLInputElement>('input[aria-label="Block"]')
    names?.[names.length - 1]?.focus()
  }, [rows])

  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !toggle.current?.contains(target)) onClose(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose(true)
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [onClose, toggle])

  return createPortal(
    <div
      ref={panel}
      // aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- a popover in the app's own stacking, as TemplatesDialog explains
      role="dialog"
      aria-label="Block mix"
      className="popover popover-enter border-hairline border-border-hover bg-overlay fixed z-60 flex w-75 flex-col gap-1.5 rounded-lg p-1.5"
    >
      <ul className="flex max-h-65 flex-col gap-1.5 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[1.5rem_1fr_1.5rem] items-center gap-1.5">
            <i
              aria-hidden="true"
              // eslint-disable-next-line no-restricted-syntax -- a block's colour, from data at runtime
              style={{ background: r.block.trim() ? blockCss(bareId(r.block)) : undefined }}
              className="border-hairline border-border-hover block size-3 justify-self-center rounded-sm"
            />
            <span className="border-hairline border-border-hover bg-surface focus-within:border-accent flex h-7 min-w-0 items-center rounded-md">
              <input
                aria-label="Block"
                value={r.block}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => change(r.key, { block: e.currentTarget.value })}
                className="text-text-primary h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none"
              />
              <input
                aria-label="Chance"
                value={r.chance}
                inputMode="decimal"
                autoComplete="off"
                onChange={(e) => change(r.key, { chance: chanceText(e.currentTarget.value) })}
                className="border-l-hairline border-border-subtle text-text-secondary h-full w-10 shrink-0 bg-transparent pr-0.5 pl-2 text-right font-mono text-xs outline-none"
              />
              <span className="text-text-muted pr-2 font-mono text-xs">%</span>
            </span>
            <button
              type="button"
              aria-label={`Remove ${r.block.trim() || 'block'}`}
              disabled={rows.length < 2}
              onClick={() => write(rows.filter((x) => x.key !== r.key))}
              className={`text-text-muted hover:text-danger hover:bg-hover grid size-6 place-items-center rounded-md disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent ${FOCUS}`}
            >
              <Icon name="close" size="xs" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          added.current = true
          write(addRow(rows))
        }}
        className={`text-text-secondary hover:text-text-primary hover:bg-hover grid h-7 grid-cols-[1.5rem_1fr] items-center gap-1.5 rounded-md text-left text-xs font-semibold ${FOCUS}`}
      >
        <Icon name="plus" size="xs" className="justify-self-center" />
        Add block
      </button>
    </div>,
    document.getElementById('root') ?? document.body,
  )
}
