import { Component, lazy, Suspense, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { stackCommand } from '../../worldedit/stack/command'
import { find, isolated } from '../../worldedit/stack/edit'
import type { Layer } from '../../worldedit/stack/layers'
import { FOCUS } from '../editors/fieldStyles'
import { Listbox } from '../ui/Listbox'
import { Tooltip } from '../ui/Tooltip'
import { SEG, SEG_BUTTON } from './styles'
import { ViewMenu } from './ViewMenu'
import { useReferenceVoxels } from './viewport/useReferenceVoxels'
import { EDITOR_MAX_SIZE, useVoxels } from './viewport/useVoxels'

const ViewportStage = lazy(() => import('./viewport/ViewportStage'))

const SIZES = [16, 32, 48, 64, EDITOR_MAX_SIZE].map((s) => ({
  value: String(s),
  label: `${s}³`,
}))

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
  const round = useShapeEditorStore((s) => s.round)
  const pattern = useShapeEditorStore((s) => s.pattern)
  const isolate = useShapeEditorStore((s) => s.isolate)
  const layers = useShapeEditorStore((s) => s.layers)
  const setIsolate = useShapeEditorStore((s) => s.setIsolate)
  const [size, setSize] = useState<number>(32)
  const [home, setHome] = useState(0)
  // Isolated, the view shows the one layer while the command stays whole.
  const shown = useMemo(
    () => (isolate === null ? null : isolated(layers, isolate)),
    [layers, isolate],
  )
  const source = useMemo(
    () =>
      shown === null
        ? expression
        : stackCommand({ layers: shown, pattern, hollow, round }).expression,
    [shown, expression, pattern, hollow, round],
  )
  const voxels = useVoxels(source, size, hollow)
  const commands = useMemo(() => referenceCommands(shown ?? layers), [shown, layers])
  const references = useReferenceVoxels(commands, size)
  const isolatedLayer = isolate === null ? null : find(layers, isolate)?.layer

  return (
    <section ref={opening} aria-label="Viewport" className="relative min-h-0">
      {stage !== null &&
        createPortal(
          <StageBoundary>
            <Suspense fallback={null}>
              <ViewportStage
                field={voxels.field}
                pattern={pattern}
                layers={shown ?? layers}
                references={references}
                size={size}
                homeKey={home}
                opening={opening}
              />
            </Suspense>
          </StageBoundary>,
          stage,
        )}

      <div
        data-chrome
        className="pointer-events-none absolute inset-x-2.5 top-2.5 flex flex-wrap gap-2 [&>*]:pointer-events-auto"
      >
        {isolatedLayer && (
          <div className={SEG}>
            <button
              type="button"
              aria-pressed="true"
              aria-label="Show all shapes"
              onClick={() => setIsolate(null)}
              className={`${SEG_BUTTON} ${FOCUS}`}
            >
              <span className="max-w-36 truncate">{isolatedLayer.name}</span>
              <kbd className="text-accent text-2xs font-mono">S</kbd>
            </button>
          </div>
        )}
        <span className="pointer-events-none flex-1" />
        <ViewMenu />
        <div className={SEG}>
          <Tooltip label="Samples per axis. In game this is your selection size." side="bottom">
            <Listbox
              bare
              aria-label="Preview resolution"
              value={String(size)}
              options={SIZES}
              onChange={(s) => setSize(Number(s))}
            />
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

/** The commands of the References the view draws: visible, and not inside a hidden group. */
function referenceCommands(layers: readonly Layer[]): string[] {
  const out: string[] = []
  for (const layer of layers) {
    if (!layer.visible) continue
    if (layer.type === 'reference') out.push(layer.command)
    else if (layer.type === 'group') out.push(...referenceCommands(layer.children))
  }
  return out
}
