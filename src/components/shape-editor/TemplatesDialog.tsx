import { useEffect, useRef, useState } from 'react'
import { TEMPLATES, type TemplateSpec } from '../../data/authored/generate'
import { FOCUS } from '../editors/fieldStyles'
import { Icon } from '../ui/Icon'
import { PANEL_HEAD } from './styles'

/**
 * The templates, one tile each, with a picture of its blocks. Picking one adds it as a
 * group named after it.
 *
 * The dialog opens at once; each picture fills in as it is drawn, and is kept for the
 * rest of the session.
 */
export function TemplatesDialog({
  onPick,
  onClose,
}: {
  onPick: (template: TemplateSpec) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const pictures = usePictures()
  useEffect(() => {
    dialog.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="bg-canvas/60 fixed inset-0 z-70 grid place-items-center p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialog}
        // aislop-ignore-next-line jsx-a11y/prefer-tag-over-role -- showModal() would leave the app's own stacking, as SettingsDialog explains
        role="dialog"
        aria-modal="true"
        aria-label="Templates"
        className="border-hairline border-border-hover bg-overlay rounded-panel popover-enter flex max-h-full w-full max-w-190 flex-col overflow-hidden"
      >
        <div className={`${PANEL_HEAD} justify-between`}>
          <span className="font-display text-sm font-bold">Templates</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`text-text-faint hover:text-text-primary hover:bg-hover grid size-6 place-items-center rounded ${FOCUS}`}
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(calc(var(--spacing)*40),1fr))] gap-2 overflow-y-auto p-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template)}
              className={`border-hairline border-border-subtle bg-surface text-text-secondary hover:border-accent hover:text-text-primary flex flex-col gap-1.5 rounded-md p-1.5 pb-2 text-left text-xs font-semibold ${FOCUS}`}
            >
              <span aria-hidden="true" className="bg-canvas aspect-4/3 overflow-hidden rounded-sm">
                {pictures[template.id] && (
                  <img src={pictures[template.id]} alt="" className="size-full object-cover" />
                )}
              </span>
              <span className="px-0.5">{template.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Each template's picture by id, as they arrive. */
function usePictures(): Readonly<Record<string, string>> {
  const [pictures, setPictures] = useState<Readonly<Record<string, string>>>({})
  useEffect(() => {
    let live = true
    void import('./viewport/thumbnails').then(({ pictureOf }) => {
      for (const template of TEMPLATES) {
        void pictureOf(template).then((url) => {
          if (live && url !== '') setPictures((p) => ({ ...p, [template.id]: url }))
        })
      }
    })
    return () => {
      live = false
    }
  }, [])
  return pictures
}
