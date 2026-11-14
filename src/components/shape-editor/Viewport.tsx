import { Component, lazy, Suspense, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { find } from '../../worldedit/stack/edit'
import { FOCUS } from '../editors/fieldStyles'
import { Tooltip } from '../ui/Tooltip'
import { SEG, SEG_BUTTON } from './styles'
import { EDITOR_MAX_SIZE, useVoxels } from './viewport/useVoxels'

const ViewportStage = lazy(() => import('./viewport/ViewportStage'))

const SIZES = [16, 32, 48, 64, EDITOR_MAX_SIZE] as const

/**
 * The opening onto the 3D view, and the view itself.
 *
 * The view fills the editor behind the tiles, so its canvas is portalled into `stage`,
 * and this cell in the grid is only a hole in the tiles: transparent, letting the
 * pointer through to the canvas, holding the view's controls. The camera is framed on
 * it (`ViewportStage.tsx`), so the build sits centred between the tiles.
 *
 * Eager and free of 3D code, like `PreviewCanvas`: it has to be on screen, saying what
 * it is doing, before Three.js has arrived.
 */
export function Viewport({
  expression,
  opening,
  stage,
}: {
  expression: string
  opening: RefObject<HTMLElement | null>
  /** Where the canvas goes: the editor's full area, under everything else. */
  stage: HTMLElement | null
}) {
  const hollow = useShapeEditorStore((s) => s.hollow)
  const isolate = useShapeEditorStore((s) => s.isolate)
  const layers = useShapeEditorStore((s) => s.layers)
  const setIsolate = useShapeEditorStore((s) => s.setIsolate)
  const [size, setSize] = useState<number>(32)
  const [home, setHome] = useState(0)
  const voxels = useVoxels(expression, size, hollow)
  const isolated = isolate === null ? null : find(layers, isolate)?.layer

  return (
    <section ref={opening} aria-label="Viewport" className="relative min-h-0">
      {stage !== null &&
        createPortal(
          <StageBoundary>
            <Suspense fallback={null}>
              <ViewportStage field={voxels.field} homeKey={home} opening={opening} />
            </Suspense>
          </StageBoundary>,
          stage,
        )}

      <div
        data-chrome
        className="pointer-events-none absolute inset-x-2.5 top-2.5 flex flex-wrap gap-2 [&>*]:pointer-events-auto"
      >
        {isolated && (
          <div className={SEG}>
            <button
              type="button"
              aria-pressed="true"
              aria-label="Show all shapes"
              onClick={() => setIsolate(null)}
              className={`${SEG_BUTTON} ${FOCUS}`}
            >
              <span className="max-w-36 truncate">{isolated.name}</span>
              <kbd className="text-accent text-2xs font-mono">S</kbd>
            </button>
          </div>
        )}
        <span className="pointer-events-none flex-1" />
        <div className={SEG}>
          <Tooltip label="Samples per axis. In game this is your selection size." side="bottom">
            <select
              aria-label="Preview resolution"
              value={size}
              onChange={(e) => setSize(Number(e.currentTarget.value))}
              className="text-text-secondary h-6.5 bg-transparent px-1 text-xs font-semibold outline-none"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}³
                </option>
              ))}
            </select>
          </Tooltip>
          <Tooltip label="Reset the camera" side="bottom">
            <button
              type="button"
              aria-label="Reset the camera"
              onClick={() => setHome((h) => h + 1)}
              className={`${SEG_BUTTON} ${FOCUS}`}
            >
              <CameraGlyph />
            </button>
          </Tooltip>
        </div>
      </div>

      {voxels.field === null && voxels.reason !== null && (
        <p className="text-text-muted pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-xs">
          {voxels.reason}
        </p>
      )}

      <div
        data-chrome
        className="pointer-events-none absolute inset-x-3 bottom-2.5 flex flex-wrap items-end justify-between gap-3"
      >
        <span className="bg-canvas/80 text-text-secondary text-1xs rounded-sm px-2 py-1 font-mono tabular-nums">
          {voxels.field
            ? `${voxels.field.count.toLocaleString('en')} blocks · ${voxels.field.size}³`
            : '–'}
        </span>
        {voxels.pending && (
          <output className="bg-canvas/80 text-text-secondary text-1xs flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono">
            <span aria-hidden="true" className="spinner" />
            Evaluating
          </output>
        )}
      </div>
    </section>
  )
}

function CameraGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      className="size-3.5"
    >
      <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

/** A canvas that fails to start (no WebGL) says so rather than taking the editor down. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="text-text-muted grid h-full place-items-center p-6 text-center text-xs">
          The 3D view could not start. The command is unaffected.
        </p>
      )
    }
    return this.props.children
  }
}
