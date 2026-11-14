import { useState } from 'react'
import type { FullEditorProps } from '../../previews/types'
import { snapshotOf, useShapeEditorStore } from '../../stores/useShapeEditorStore'
import { doneValues, openSnapshot } from './binding'
import { ShapeEditor } from './ShapeEditor'

/**
 * The shape preview's full-screen editor (`PreviewModule.editor`), loaded with the
 * editor's whole chunk behind one dynamic import.
 *
 * Loads the sheet's values into the editor's store before its first render, so the
 * editor never paints the previous document, and hands the store back as values on
 * Done.
 */
export default function ShapeEditorModule({ values, origin, onDone }: FullEditorProps) {
  useState(() => useShapeEditorStore.getState().load(openSnapshot(values)))
  return (
    <ShapeEditor
      origin={origin}
      onDone={(command) => onDone(doneValues(snapshotOf(useShapeEditorStore.getState()), command))}
    />
  )
}
