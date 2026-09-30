import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Segment } from '../schema/serialize'
import { outputStatus, statusMessage, type OutputStatus } from '../schema/output-status'
import { useLit, useOutputHover } from '../stores/useOutputHover'
import { Icon } from './ui/Icon'
import { IconButton } from './ui/IconButton'
import { FOCUS, WARNING } from './editors/fieldStyles'

/**
 * The command, pinned above the form that builds it.
 *
 * Sticky, so a long `/give` never scrolls it away: the command is the product and the
 * form is how you reach it. The wrapper paints the editor panel's own background (the
 * canvas under a surface wash, as `CommandOverlay` does) so rows scroll under it rather
 * than through it, and reaches up over the gap above so nothing shows between the panel
 * and the top edge once it is pinned.
 *
 * Every line in it is always there, whatever the command's state, so nothing below
 * moves when the command becomes complete, too long, or empty: the status line changes
 * its words, never its height.
 */
export function OutputPanel({
  text,
  segments,
  versionId,
  warnings,
  history,
  actions,
}: {
  text: string
  segments: readonly Segment[]
  versionId: string
  /** Cross-argument rules the command breaks, already worded. */
  warnings: readonly string[]
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }
  /** The save controls, which the workbench is handed rather than knowing about. */
  actions?: ReactNode
}) {
  const status = outputStatus(segments, text)

  return (
    <div className="bg-canvas sticky top-0 z-10 -mt-4 bg-[linear-gradient(var(--bg-surface),var(--bg-surface))] pt-4 pb-3">
      <section
        aria-label="Output"
        className="border-hairline border-border-hover bg-elevated rounded-panel flex flex-col gap-2 p-3"
      >
        {/* Wraps rather than squeezing: on a narrow panel the buttons drop under the
            command, which keeps its full width, instead of pushing it to nothing. */}
        <div className="flex flex-wrap items-center gap-2">
          {/*
            `min-w-0` is what lets the line scroll inside its own box: a flex child's
            default `min-width: auto` refuses to shrink below its content, so an
            unbreakable line of monospace would push the buttons off the edge instead.

            One line and a scrollbar rather than a wrap. A command is one line by
            construction, `distribution.md` § The one-shot handoff turns on that, and a
            wrap would misrepresent the shape of what is copied.
          */}
          <div className="bg-canvas border-hairline border-border-subtle flex min-h-10 min-w-0 flex-1 basis-60 items-center overflow-x-auto rounded-md px-3 py-2">
            <CommandLine text={text} segments={segments} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <IconButton title="Undo" onClick={history.undo} disabled={!history.canUndo}>
              <Icon name="undo" size="sm" />
            </IconButton>
            <IconButton title="Redo" onClick={history.redo} disabled={!history.canRedo}>
              <Icon name="redo" size="sm" />
            </IconButton>
            {actions}
            <CopyButton text={text} />
          </div>
        </div>
        <StatusLine status={status} versionId={versionId} />
        {warnings.map((message, i) => (
          <span key={i} className={WARNING}>
            {message}
          </span>
        ))}
      </section>
    </div>
  )
}

/**
 * The command drawn as its pieces.
 *
 * Each piece is keyed on its node and its text, so a piece whose text changes is a new
 * element and plays `.segments-live`'s one flash, and one that did not change is left
 * alone. The class goes on after the first paint, so opening a command does not flash
 * every piece at once.
 *
 * The spaces between pieces are text nodes, so selecting the line and copying it by
 * hand gives exactly the text the Copy button writes.
 */
function CommandLine({ text, segments }: { text: string; segments: readonly Segment[] }) {
  const code = useRef<HTMLElement>(null)
  useEffect(() => {
    code.current?.classList.add('segments-live')
  }, [])

  return (
    <code ref={code} className="font-mono text-sm whitespace-nowrap">
      {text === '' ? (
        <span className="text-text-faint">nothing yet</span>
      ) : (
        segments.map((segment, i) => (
          <span key={`${segment.path}\u0000${segment.text}`}>
            {i > 0 && ' '}
            <SegmentView segment={segment} />
          </span>
        ))
      )}
    </code>
  )
}

function SegmentView({ segment }: { segment: Segment }) {
  const lit = useLit(segment.field)
  const hover = useOutputHover((s) => s.hover)
  const { field } = segment
  return (
    <span
      className={`segment segment-${segment.kind} ${lit ? 'segment-lit' : ''}`}
      onPointerEnter={field === undefined ? undefined : () => hover(field)}
      onPointerLeave={field === undefined ? undefined : () => hover(null)}
    >
      {segment.text}
    </span>
  )
}

const DOT: Record<OutputStatus['kind'], string> = {
  empty: 'bg-text-faint',
  incomplete: 'bg-warning',
  chat: 'bg-success',
  'command-block': 'bg-warning',
  'too-long': 'bg-danger',
}

/**
 * What the command is ready for, in one line that is always there.
 *
 * An `<output>`, which is a polite live region, so a screen reader hears "Ready to paste in chat" when the last
 * missing part is filled rather than having to go and look.
 */
function StatusLine({ status, versionId }: { status: OutputStatus; versionId: string }) {
  return (
    <div className="text-1xs flex items-center gap-2 px-1">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status.kind]}`} />
      <output className="text-text-secondary min-w-0 flex-1 truncate">
        {statusMessage(status)}
      </output>
      {'length' in status && (
        <span className="text-text-muted border-r-hairline border-border-hover pr-2 font-mono tabular-nums">
          {`${status.length} / ${status.limit}`}
        </span>
      )}
      <span className="text-text-muted font-mono">{`Java ${versionId}`}</span>
    </div>
  )
}

/**
 * Copy the command: the last step of every session, so the primary button.
 *
 * What it last did is remembered with the text it did it to, and shown only while that
 * is still the text on screen. So an edit resets it without an effect that would set
 * state after every keystroke. The clipboard API rejects when the document is not
 * focused or permission is refused, and the button says so rather than reporting
 * success.
 */
function CopyButton({ text }: { text: string }) {
  const [last, setLast] = useState<{ text: string; ok: boolean } | null>(null)
  const state = last?.text === text ? (last.ok ? 'copied' : 'failed') : 'idle'

  return (
    <button
      type="button"
      disabled={text === ''}
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setLast({ text, ok: true }),
          () => setLast({ text, ok: false }),
        )
      }}
      className={`${FOCUS} bg-accent text-canvas hover:bg-accent/85 duration-fast ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none`}
    >
      <Icon name={state === 'copied' ? 'check' : 'copy'} size="sm" />
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : 'Copy'}
    </button>
  )
}
