import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FOCUS } from '../editors/fieldStyles'

/**
 * Asks before a step that throws work away.
 *
 * Konnekt's confirm dialog: a hairline card over a dimmed window, a quiet Cancel and a
 * danger action. Cancel holds the focus when it opens, so Enter alone never confirms;
 * Tab moves between the two, and Escape or a press outside the card cancels.
 */
export function ConfirmDialog({
  title,
  body,
  action,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  /** The danger button's label, the verb the dialog asks about. */
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ids = { title: useId(), body: useId() }
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancel.current?.focus({ preventScroll: true })
    // Taken before anything behind the dialog hears it: the keys are the dialog's.
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      } else if (event.key === 'Tab') {
        event.preventDefault()
        const next = document.activeElement === confirm.current ? cancel : confirm
        next.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return createPortal(
    <div
      className="bg-canvas/60 fixed inset-0 z-70 grid place-items-center p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        // aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- showModal() would leave the app's own stacking, as SettingsDialog explains
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        className="border-hairline border-border-hover bg-canvas popover-enter flex w-80 max-w-full flex-col gap-4 rounded-xl p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id={ids.title} className="text-text-primary text-sm font-semibold">
            {title}
          </h2>
          <p id={ids.body} className="text-text-secondary text-xs">
            {body}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            onClick={onCancel}
            className={`text-text-muted hover:text-text-primary rounded-sm px-3 py-1.5 text-xs font-medium ${FOCUS}`}
          >
            Cancel
          </button>
          <button
            ref={confirm}
            type="button"
            onClick={onConfirm}
            className={`border-hairline border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 rounded-sm px-3 py-1.5 text-xs font-medium ${FOCUS}`}
          >
            {action}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  )
}
