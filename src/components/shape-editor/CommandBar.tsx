import { useId, useState, type Ref } from 'react'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { CHAT_LIMIT, COMMAND_BLOCK_LIMIT, type StackCommand } from '../../worldedit/stack/command'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { Switch } from '../ui/Switch'
import { Tooltip } from '../ui/Tooltip'
import { BlocksField } from './BlockMix'
import { PANEL, PRIMARY } from './styles'

/**
 * The command the stack compiles to, pinned under the editor, with the options that
 * change it: Hollow, Round numbers and the blocks.
 */

const FITS = {
  chat: { tone: 'text-success bg-success/10', limit: CHAT_LIMIT, where: 'Fits in chat' },
  'command block': {
    tone: 'text-warning bg-warning/10',
    limit: COMMAND_BLOCK_LIMIT,
    where: 'Too long for chat, fits a command block',
  },
  neither: {
    tone: 'text-danger bg-danger/10',
    limit: COMMAND_BLOCK_LIMIT,
    where: 'Too long for a command block',
  },
} as const

export function CommandBar({ command, ref }: { command: StackCommand; ref?: Ref<HTMLElement> }) {
  const hollow = useShapeEditorStore((s) => s.hollow)
  const round = useShapeEditorStore((s) => s.round)
  const setHollow = useShapeEditorStore((s) => s.setHollow)
  const setRound = useShapeEditorStore((s) => s.setRound)
  const ids = { hollow: useId(), round: useId() }
  const fits = FITS[command.fits]

  return (
    <footer
      ref={ref}
      className={`${PANEL} pointer-events-auto relative mx-2.5 grid grid-cols-1 items-center gap-3.5 px-3 py-2.5 lg:grid-cols-[auto_minmax(0,1fr)_auto]`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 lg:flex-col lg:items-start">
        <div className="flex h-7 items-center gap-4">
          <label
            htmlFor={ids.hollow}
            className="text-text-secondary flex cursor-pointer items-center gap-2 text-xs font-semibold"
          >
            <Switch id={ids.hollow} checked={hollow} onChange={setHollow} />
            Hollow
            <span className="text-text-faint text-1xs font-mono">-h</span>
          </label>
          <Tooltip label="Rounds long decimals, such as the ones turns produce, to four significant digits.">
            <label
              htmlFor={ids.round}
              className="text-text-secondary flex cursor-pointer items-center gap-2 text-xs font-semibold"
            >
              <Switch id={ids.round} checked={round} onChange={setRound} />
              Round numbers
            </label>
          </Tooltip>
        </div>
        <BlocksField />
      </div>

      <div
        data-command-box
        className="border-hairline border-border-subtle bg-canvas flex h-[var(--command-height,calc(var(--spacing)*16.5))] min-w-0 flex-col overflow-hidden rounded-md"
      >
        <output
          aria-label="Command"
          className="min-h-0 flex-1 overflow-auto px-2.5 pt-1.5 font-mono text-xs leading-normal break-all whitespace-pre-wrap"
        >
          {command.text}
        </output>
        <div className="text-text-muted text-1xs flex h-6 shrink-0 items-center gap-2.5 overflow-hidden px-2.5 pb-0.5 whitespace-nowrap">
          <Tooltip label={fits.where}>
            <span className={`rounded-sm px-1.5 py-px font-mono ${fits.tone}`}>
              {command.text.length.toLocaleString('en')} / {fits.limit.toLocaleString('en')}
            </span>
          </Tooltip>
          {command.shared > 0 && (
            <span>
              {command.shared} shared {command.shared === 1 ? 'part' : 'parts'}
            </span>
          )}
          {command.diagnostics[0] && (
            <span className="text-warning min-w-0 flex-1 truncate">
              {command.diagnostics[0].message}
            </span>
          )}
        </div>
      </div>

      <CopyButton text={command.text} />
    </footer>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={`${PRIMARY} ${FOCUS}`}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size="sm" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
