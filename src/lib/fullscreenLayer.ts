import { createContext, useContext } from 'react'

/**
 * Where a full-screen editor is drawn: the area below the app header that the command
 * sheet's overlay covers.
 *
 * The overlay provides the element, because it is the one component that knows that
 * area; a sheet's content cannot reach it otherwise, since the sheet's own frame clips
 * and transforms what is inside it. Null outside an overlay, as in a test that renders
 * the workbench alone, where the editor is drawn in place instead.
 */
export const FullscreenLayer = createContext<HTMLElement | null>(null)

export const useFullscreenLayer = (): HTMLElement | null => useContext(FullscreenLayer)
