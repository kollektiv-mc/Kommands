import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Object3D } from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useShapeEditorStore } from '../../../stores/useShapeEditorStore'
import { find } from '../../../worldedit/stack/edit'
import type { Layer } from '../../../worldedit/stack/layers'
import { stepOf } from './faces'
import { snapToBlocks, transformOf } from './gizmo'

const DEG = Math.PI / 180

/**
 * Edit mode's move, rotate and scale gizmo, on the selected layer.
 *
 * Three's transform controls, in the layer's own space. A drag writes the layer's
 * transform back into the document as it goes, as one undo step; the camera leaves
 * alone a press that lands on it (`ViewControls`). Snap rounds moves to the chosen step, or to the preview's block
 * centres; turns and scales always snap to their steps while Snap is on.
 */
export function Gizmo({
  layers,
  objects,
  onControls,
  size,
}: {
  layers: readonly Layer[]
  objects: ReadonlyMap<string, Object3D>
  /** Hands out the controls, so the camera can tell a press on the gizmo. */
  onControls: (controls: TransformControls | null) => void
  size: number
}) {
  const { camera, gl, scene } = useThree()
  const edit = useShapeEditorStore((s) => s.edit)
  const selected = useShapeEditorStore((s) => s.selected)
  const gizmo = useRef<TransformControls | null>(null)
  const step = useRef(stepOf(size))
  useEffect(() => {
    step.current = stepOf(size)
  }, [size])

  useEffect(() => {
    const c = new TransformControls(camera, gl.domElement)
    c.setSpace('local')
    c.setSize(0.8)
    const helper = c.getHelper()
    scene.add(helper)
    const onDragging = (event: { value: unknown }) => {
      const dragging = event.value === true
      const store = useShapeEditorStore.getState()
      store.setDragging(dragging)
      if (!dragging) store.settle()
    }
    const onChange = () => {
      const store = useShapeEditorStore.getState()
      const o = c.object
      if (store.selected === null || o === undefined) return
      if (store.edit.snap && store.edit.snapTo === 'blocks' && c.mode === 'translate')
        snapToBlocks(o, step.current)
      const placed = transformOf(o)
      store.change(store.selected, (l) => ({ ...l, ...placed }), 'gizmo')
    }
    c.addEventListener('dragging-changed', onDragging)
    c.addEventListener('objectChange', onChange)
    gizmo.current = c
    onControls(c)
    return () => {
      c.removeEventListener('dragging-changed', onDragging)
      c.removeEventListener('objectChange', onChange)
      c.detach()
      scene.remove(helper)
      c.dispose()
      gizmo.current = null
      onControls(null)
    }
  }, [camera, gl, scene, onControls])

  // After the layers have drawn, so the selected layer's object is there to hold.
  useEffect(() => {
    const controls = gizmo.current
    if (controls === null) return
    const o = selected === null ? undefined : objects.get(selected)
    const layer = selected === null ? null : find(layers, selected)?.layer
    if (!edit.on || o === undefined || layer === null || layer === undefined) controls.detach()
    else if (controls.object !== o) controls.attach(o)
    controls.setMode(edit.mode)
    const snap = edit.snap
    controls.setTranslationSnap(snap && edit.snapTo === 'grid' ? edit.move : null)
    controls.setRotationSnap(snap ? edit.turn * DEG : null)
    controls.setScaleSnap(snap ? edit.scale : null)
  }, [edit, selected, layers, objects])

  return null
}
