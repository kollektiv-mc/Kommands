import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { RegistryLookup } from '../data/versions/types'
import type { EditorOrigin } from '../lib/editorMotion'
import { useFullscreenLayer } from '../lib/fullscreenLayer'
import type { FullEditorProps, PreviewModule } from '../previews/types'

type EditorLoader = NonNullable<PreviewModule['editor']>

/**
 * A preview module's full-screen editor, drawn over the sheet below the app header.
 *
 * Generic, like the workbench that holds it: it knows a module has an editor, never
 * which. The lazy component is made once per loader, outside render, so a re-render of
 * the sheet never mounts the editor afresh.
 */
const loaded = new WeakMap<EditorLoader, ComponentType<FullEditorProps>>()
function editorOf(load: EditorLoader): ComponentType<FullEditorProps> {
  let component = loaded.get(load)
  if (component === undefined) {
    component = lazy(load)
    loaded.set(load, component)
  }
  return component
}

export function FullEditorHost({
  load,
  values,
  registry,
  origin,
  onDone,
}: {
  load: EditorLoader
  values: Readonly<Record<string, unknown>>
  registry: RegistryLookup
  origin: () => EditorOrigin | null
  onDone: (values: Readonly<Record<string, unknown>> | null) => void
}) {
  const layer = useFullscreenLayer()
  const Editor = editorOf(load)
  const editor = (
    <div className={`pointer-events-auto inset-0 ${layer === null ? 'fixed z-40' : 'absolute'}`}>
      <EditorBoundary onClose={() => onDone(null)}>
        <Suspense fallback={null}>
          <Editor values={values} registry={registry} origin={origin} onDone={onDone} />
        </Suspense>
      </EditorBoundary>
    </div>
  )
  return layer === null ? editor : createPortal(editor, layer)
}

/** An editor that fails to load or throws says so and lets you back to the sheet. */
class EditorBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="bg-canvas text-text-muted flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs">
        The editor could not start. The command is unaffected.
        <button
          type="button"
          onClick={this.props.onClose}
          className="border-hairline border-border-hover text-text-primary hover:bg-hover inline-flex h-8 items-center rounded-md px-3 text-xs font-medium"
        >
          Back to the command
        </button>
      </div>
    )
  }
}
