import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { flipIn, flipOut } from '../lib/flip'
import { FullscreenLayer } from '../lib/fullscreenLayer'
import { useSheetSize } from '../lib/useSheetSize'
import { originOf, useUiStore } from '../stores/useUiStore'

/**
 * The editor, as a sheet centred over the dimmed dashboard.
 *
 * As big as the command it holds and no bigger: a command of three fields gets a small
 * sheet and a command with a preview a wide one. When the command or its choices change
 * what the sheet holds, the sheet glides to its new size (`useSheetSize`). Moving to
 * another command waits for the one on screen to fade out first, and the new one fades
 * in once the sheet has its size.
 *
 * Owns the whole open/close gesture: the entrance that grows out of the tile, the
 * exit that shrinks back into it, the dim behind, and the three ways out.
 *
 * Scoped to its layout container rather than to the viewport — `absolute`, not
 * `fixed` — so the app header stays visible and clickable, exactly as Konnekt's
 * maximize does. The product name in the header remains a way home while a command is
 * open.
 */
export function CommandOverlay({
  originKey,
  label,
  header,
  contentKey,
  children,
}: {
  /** The saved command this was opened from, if any. Keys the rect to grow from. */
  originKey?: string
  /** Names the dialog for a screen reader. The command's label, when there is one. */
  label?: string
  /** The header band's own content, beside the Editor mark: the command switcher. */
  header?: ReactNode
  /** What is shown: a change of it is a change of the whole content, not of a part. */
  contentKey?: string
  children: ReactNode
}) {
  const {
    stage,
    sheet: panel,
    header: band,
    frame,
    content,
    leave,
    settle,
  } = useSheetSize<HTMLDivElement>()
  const backdrop = useRef<HTMLDivElement>(null)
  // State rather than a ref, so the content below learns the element once it exists.
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const closing = useRef(false)
  const navigate = useNavigate()
  const originFor = useUiStore((s) => s.originFor)

  /**
   * Where to collapse to, measured **now** rather than replayed from the open.
   *
   * The dashboard is still mounted, so the tile can be found and measured live. That
   * matters because the list may have re-sorted while the editor was open — saving
   * moves `updatedAt`, which reorders the Saved panel under the dim. Collapsing to
   * where the tile *is* is right; collapsing to where it *was* is a glitch that looks
   * like the animation missing.
   *
   * Falls back to the rect captured at open, and then to nothing, which `flipOut`
   * renders as a scale-down where the panel stands.
   */
  const collapseTo = useCallback(() => {
    if (originKey === undefined) return null
    const tile = document.querySelector(`[data-saved-id="${CSS.escape(originKey)}"]`)
    return originOf(tile) ?? originFor(originKey)
  }, [originKey, originFor])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    flipOut(
      panel.current,
      collapseTo(),
      backdrop.current,
      () => void navigate({ to: '/dashboard' }),
    )
  }, [collapseTo, navigate, panel])

  // Another command, or the list: the one on screen fades out before the route changes,
  // and the new one is placed and faded in once the sheet has resized to it.
  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (closing.current || next.pathname === current.pathname) return false
      if (!/^\/c(\/|$)/.test(next.pathname)) return false
      await leave()
      // In case the route lands on what is already shown, which no change of key reveals.
      window.setTimeout(settle, 1000)
      return false
    },
    enableBeforeUnload: false,
  })
  useLayoutEffect(settle, [contentKey, settle])

  useLayoutEffect(() => {
    if (!panel.current) return
    return flipIn(panel.current, originFor(originKey), backdrop.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, like the open it animates
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Something inside (the command switcher, a list) already took this Escape.
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // One guard: a search field with something in it takes Escape for itself. The
      // command nav has one, and clearing a filter should not also close the editor.
      const target = event.target as HTMLElement | null
      if (target instanceof HTMLInputElement && target.type === 'search' && target.value !== '') {
        return
      }
      close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <>
      {/*
        The dim. `bg-overlay/70` is a semantic token with an opacity modifier, not a
        literal — the hex grep stays silent and a theme change still reaches it.
        `aria-hidden` because the dashboard beneath is already `inert`; this element is
        a surface, not content.
      */}
      <div
        ref={backdrop}
        aria-hidden="true"
        onClick={close}
        className="bg-overlay/70 absolute inset-0"
      />
      {/*
        The stage centres the sheet and lets presses through to the dim around it.
        `absolute`, not `fixed`, so the app header stays visible and clickable.
      */}
      <div
        ref={stage}
        className="pointer-events-none absolute inset-0 flex items-center justify-center p-2 sm:p-3"
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={label ?? 'Command editor'}
          /*
            Opaque, and that is the fix rather than a preference: `bg-elevated` is
            translucent on purpose, and a layer over a grid of command tiles cannot afford
            that, since their text read through it. `bg-canvas` under a `bg-surface`
            layer is Konnekt's maximized `TileWrapper` recipe, so the two products'
            panels are the same surface. The size is the content's, written and
            animated by `useSheetSize`.
          */
          className="sheet pointer-events-auto relative"
        >
          <div
            aria-hidden="true"
            className="border-hairline border-border-subtle bg-canvas rounded-panel absolute inset-0 bg-[linear-gradient(var(--bg-surface),var(--bg-surface))]"
          />
          <div className="relative flex h-full flex-col">
            {/*
              The band that says where you are: the editor, not the dashboard. The
              accent wash and the Editor mark are what the dashboard's panels do not
              have. Laid out at the sheet's width, so it resizes with the sheet.
            */}
            <div
              ref={band}
              className="border-b-hairline border-accent/30 bg-accent/10 rounded-t-panel flex shrink-0 items-center gap-3 px-3 py-2"
            >
              <span className="bg-accent text-canvas text-2xs rounded-sm px-1.5 py-0.5 font-bold tracking-wider uppercase">
                Editor
              </span>
              {header}
              <span className="flex-1" />
              <kbd
                aria-hidden="true"
                className="border-hairline border-border-hover text-text-faint text-1xs hidden rounded-sm px-1 font-mono sm:inline"
              >
                Esc
              </kbd>
              <button
                type="button"
                onClick={close}
                aria-label="close editor"
                className="text-text-faint hover:text-text-primary hover:bg-hover flex h-6 w-6 items-center justify-center rounded"
              >
                {/* A glyph, not an icon component: U+00D7, which renders as a cross
                    rather than as emoji. */}
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {/*
              The content at its own size in a frame of fixed size, clipped by the
              sheet while the sheet is smaller than it: nothing in here is laid out
              again while the sheet resizes around it.
            */}
            <div className="rounded-b-panel min-h-0 flex-1 overflow-hidden">
              <div ref={frame} className="relative">
                <div ref={content} className="sheet-content overflow-auto">
                  <FullscreenLayer.Provider value={layer}>{children}</FullscreenLayer.Provider>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/*
        Where a full-screen editor opened from the sheet is drawn: the same area as the
        dim, over the sheet (and over its pinned output, which is raised), and still
        below the app header.
      */}
      <div ref={setLayer} className="pointer-events-none absolute inset-0 z-20" />
    </>
  )
}
