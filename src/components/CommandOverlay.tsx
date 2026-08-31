import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { flipIn, flipOut } from '../lib/flip'
import { originOf, useUiStore } from '../stores/useUiStore'

/**
 * The editor, as a panel over the dashboard.
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
  children,
}: {
  /** The saved command this was opened from, if any. Keys the rect to grow from. */
  originKey?: string
  /** Names the dialog for a screen reader. The command's label, when there is one. */
  label?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
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
   * renders as a plain scale-down.
   */
  const collapseTo = useCallback(() => {
    if (originKey === undefined) return null
    const tile = document.querySelector(`[data-saved-id="${CSS.escape(originKey)}"]`)
    return originOf(tile) ?? originFor(originKey)
  }, [originKey, originFor])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    flipOut(panel.current, collapseTo(), backdrop.current, () => void navigate({ to: '/' }))
  }, [collapseTo, navigate])

  useLayoutEffect(() => {
    if (!panel.current) return
    return flipIn(panel.current, originFor(originKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, like the open it animates
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
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
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? 'Command editor'}
        /*
          Opaque, and that is the fix rather than a preference. `bg-elevated` is
          `rgba(…, 0.82)` — the shared token source makes it translucent on purpose,
          because that is what lets a panel read as sitting *above* the canvas rather
          than replacing it. A maximized view is the case where that stops working:
          `kollektiv/design/README.md` § Why there are two elevated surfaces names it
          exactly — "a layer that floats over arbitrary content cannot afford that:
          text and controls beneath it show through and the layer becomes unreadable
          over anything busy." Under this panel is a grid of command tiles, which is
          about as busy as this app gets, and their text was legible through the
          editor.

          `bg-canvas` under a `bg-surface` layer, which is Konnekt's maximized
          `TileWrapper` verbatim — the same two-line recipe, so the two products'
          maximized panels are the same surface rather than merely similar ones. Not
          `bg-overlay`, despite the name: the shared source defines that as the opaque
          colour an *elevated* panel resolves to, and this is a maximized tile rather
          than a floating one. The gradient is a token composition rather than a
          literal, so the hex grep stays silent and a retheme still reaches it.
        */
        className="border-hairline border-border-subtle bg-canvas rounded-panel absolute inset-2 flex flex-col overflow-hidden bg-[linear-gradient(var(--bg-surface),var(--bg-surface))] sm:inset-3"
      >
        <div className="border-b-hairline border-border-subtle flex shrink-0 items-center gap-2 px-3 py-2">
          <span className="font-title text-text-secondary text-1xs">{label ?? 'Editor'}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={close}
            aria-label="close editor"
            className="text-text-faint hover:text-text-primary hover:bg-hover flex h-6 w-6 items-center justify-center rounded"
          >
            {/* A glyph, not an icon component: this app has no icon library, and one
                would cost more of the entry budget than the whole overlay. U+00D7,
                which renders as a cross rather than as emoji. */}
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </>
  )
}
