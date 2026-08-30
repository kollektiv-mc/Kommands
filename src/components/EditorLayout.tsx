import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { CommandNav } from './CommandNav'
import type { Catalogue } from './CommandRenderer'
import { flipIn } from '../lib/flip'
import { useUiStore } from '../stores/useUiStore'

/**
 * The editor: every command generator on the left, the chosen one on the right.
 *
 * The frame both editor routes share — the one with a command and the one without —
 * so the navbar does not unmount and remount between them. That matters for more than
 * tidiness: the filter someone typed lives in the navbar, and a navbar that remounted
 * on every selection would clear it on the first click.
 *
 * The entrance animation runs here rather than in the route, because the panel that
 * should appear to grow is the content pane, and this is the component that owns it.
 */
export function EditorLayout({
  catalogue,
  activeId,
  originKey,
  children,
}: {
  catalogue: Catalogue
  activeId?: string
  /**
   * What is being opened, so the entrance can find the rect captured for it.
   *
   * A key rather than the rect itself, because the thing that captured it is a route
   * away: the dashboard records `{ key, rect }` before navigating, and this looks it
   * up. Absent — a URL open, or the editor's own index — simply finds nothing, which
   * is the plain scale-up rather than no animation.
   */
  originKey?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const originFor = useUiStore((s) => s.originFor)

  // Layout effect, not an effect: the panel has to be transformed onto its origin
  // *before* the browser paints, or the first frame shows it already at full size and
  // the animation reads as a flash followed by a jump.
  //
  // Runs once per mount, deliberately. Switching commands within the editor is a
  // selection rather than an opening — there is no tile to grow from, and re-running
  // it would scale the pane on every click in the navbar.
  //
  // `originFor` is a pure lookup, so this effect is safe to run more than once — which
  // React does, in StrictMode and increasingly elsewhere. When the lookup consumed the
  // rect instead, the second run found nothing and replaced the real animation with the
  // fallback; see useUiStore.originFor.
  useLayoutEffect(() => {
    if (!panel.current) return
    return flipIn(panel.current, originFor(originKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, see above
  }, [])

  return (
    <div className="flex h-full min-h-0">
      <CommandNav catalogue={catalogue} activeId={activeId} />
      <div ref={panel} className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
        {children}
      </div>
    </div>
  )
}
