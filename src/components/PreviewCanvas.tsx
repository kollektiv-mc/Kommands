import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import type { RegistryLookup } from '../data/versions/types'
import type { PreviewModule, PreviewStatus } from '../previews/types'
import { LABEL, WARNING } from './editors/fieldStyles'

/**
 * The panel a preview lives in.
 *
 * Eager, small, and importing no 3D code: it has to render before Three.js has been
 * fetched, because it is what tells the user that something is being fetched. The
 * renderer itself arrives with `<PreviewStage>`, one dynamic import away.
 *
 * Its other job is the one `.claude/rules/previews.md` calls out: **failure degrades,
 * never blocks**. A module that fails to load, throws while rendering, or has nothing
 * to draw all end up as an inline sentence here. None of them can reach the output
 * panel, which is a sibling in `<CommandWorkbench>` and never reads preview state.
 */
const PreviewStage = lazy(() => import('./PreviewStage'))

export function PreviewCanvas({
  module,
  values,
  registry,
}: {
  module: PreviewModule
  values: Readonly<Record<string, unknown>>
  registry: RegistryLookup
}) {
  const [status, setStatus] = useState<PreviewStatus>({})

  // Stable, so a module may report from an effect without the callback's identity
  // being a reason to run that effect again.
  const report = useCallback((next: PreviewStatus) => {
    setStatus((previous) => (sameStatus(previous, next) ? previous : next))
  }, [])

  return (
    <div className="border-hairline border-border-subtle bg-elevated rounded-panel flex flex-col gap-1 p-2">
      <div className="flex items-center gap-2">
        <span className={LABEL}>Preview</span>
        {status.cap !== undefined && <span className="text-text-faint text-2xs">{status.cap}</span>}
      </div>

      <div className="bg-canvas relative aspect-video w-full overflow-hidden rounded-md">
        <PreviewBoundary>
          <Suspense fallback={<Placeholder>Loading the preview…</Placeholder>}>
            <PreviewStage module={module} values={values} registry={registry} report={report} />
          </Suspense>
        </PreviewBoundary>
        {status.message !== undefined && <Placeholder>{status.message}</Placeholder>}
      </div>

      {(status.diagnostics ?? []).map((d, i) => (
        <span key={i} className={WARNING}>
          {d.message}
        </span>
      ))}
    </div>
  )
}

/** An inline message over an empty canvas — the documented degradation, drawn. */
function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted text-2xs absolute inset-0 flex items-center justify-center p-3 text-center">
      {children}
    </div>
  )
}

/**
 * Catch a module that throws.
 *
 * A render error inside the canvas would otherwise unmount the whole route, taking the
 * generated command down with a preview problem. Since the command is the product and
 * the preview is an aid, that trade is the wrong way round — so this boundary exists
 * even though nothing is expected to throw.
 */
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <Placeholder>The preview could not be drawn. The command is unaffected.</Placeholder>
    }
    return this.props.children
  }
}

function sameStatus(a: PreviewStatus, b: PreviewStatus): boolean {
  return (
    a.message === b.message &&
    a.cap === b.cap &&
    (a.diagnostics ?? []).length === (b.diagnostics ?? []).length &&
    (a.diagnostics ?? []).every((d, i) => d.message === b.diagnostics?.[i]?.message)
  )
}
