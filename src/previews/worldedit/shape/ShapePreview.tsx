import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Object3D, type Color, type InstancedMesh } from 'three'
import { tokenColor } from './color'
import type { Diagnostic } from '../../../schema/types'
import type { PreviewProps } from '../../types'
import { DEFAULT_SIZE, shapeVoxels, type VoxelField } from './voxels'

/**
 * `//generate`, drawn.
 *
 * Scene content only — no renderer, no scene, no camera. `<PreviewStage>` owns all
 * three, per `.claude/rules/previews.md`; a module that made its own would produce a
 * second WebGL context and leak it.
 *
 * This file is the one place in the module that imports Three.js, and it is only ever
 * reached through the `load` thunk in `./index.ts`. That is what keeps the renderer out
 * of the entry chunk for the other 78 commands.
 */

/**
 * How long to sit still before recomputing.
 *
 * The module debounces, not the canvas — `docs/adding-a-preview.md` is explicit that
 * the canvas does not do it for you, because only the module knows what its
 * recomputation costs. 32³ is 32,768 evaluations, which is fast enough to feel live
 * and far too slow to run on every keystroke of a formula being typed.
 */
const DEBOUNCE_MS = 150

/** The origin flags. Setting one changes what x, y and z mean — see the note below. */
const ORIGIN_FLAGS = ['-r', '-o', '-c'] as const

export default function ShapePreview({ values, report }: PreviewProps) {
  const source = typeof values['expression'] === 'string' ? values['expression'] : ''
  const hollow = values['-h'] === true
  const origin = ORIGIN_FLAGS.find((flag) => values[flag] === true)

  // Debounce the *inputs*, so the expensive work below re-runs on a pause rather than
  // on a keystroke. Debouncing the output instead would still evaluate every keystroke
  // and only delay showing it, which is the expensive half done anyway.
  const settled = useSettled({ source, hollow }, DEBOUNCE_MS)

  const result = useMemo(() => shapeVoxels(settled.source, DEFAULT_SIZE, settled.hollow), [settled])

  useEffect(() => {
    const diagnostics: Diagnostic[] = [...result.diagnostics]
    if (origin !== undefined) {
      // Honest rather than silent. TransformUtil takes -r, then -o, then -c, and all
      // three resolve against a selection in a world; this preview has neither, so it
      // draws the default normalised origin and says that is what it drew.
      diagnostics.push({
        severity: 'warning',
        message: `${origin} changes what x, y and z mean against the world. The preview draws the default −1..1 origin.`,
      })
    }
    report({
      message: result.ok ? undefined : result.reason,
      diagnostics,
      cap: `${DEFAULT_SIZE}³ samples`,
    })
  }, [result, origin, report])

  if (!result.ok) return null
  return <Voxels field={result.field} />
}

/**
 * One instanced mesh for the whole shape.
 *
 * Instanced because a 64³ region is 262,144 candidate positions and a mesh each would
 * be 262,144 draw calls. The geometry and material are created by JSX, so R3F disposes
 * both when this unmounts; the `Object3D` below is a scratch object that never enters
 * the scene and holds nothing to dispose.
 */
function Voxels({ field }: { field: VoxelField }) {
  const mesh = useRef<InstancedMesh>(null)

  // A layout effect rather than an ordinary one: the render loop is already running, so
  // an effect that lands a frame late shows every instance at its identity matrix — the
  // whole shape collapsed into one box at the origin — before correcting itself.
  useLayoutEffect(() => {
    const instanced = mesh.current
    if (instanced === null) return

    const scratch = new Object3D()
    const { size, filled } = field
    // Fit the region into a unit-ish box whatever the sample count, so changing the cap
    // changes the resolution rather than the size of the thing on screen.
    const step = 2 / size

    let instance = 0
    for (let iz = 0; iz < size; iz++) {
      for (let iy = 0; iy < size; iy++) {
        for (let ix = 0; ix < size; ix++) {
          if (filled[ix + iy * size + iz * size * size] !== 1) continue
          scratch.position.set(
            -1 + (ix + 0.5) * step,
            -1 + (iy + 0.5) * step,
            -1 + (iz + 0.5) * step,
          )
          scratch.updateMatrix()
          instanced.setMatrixAt(instance++, scratch.matrix)
        }
      }
    }

    instanced.count = instance
    instanced.instanceMatrix.needsUpdate = true
  }, [field])

  const step = 2 / field.size

  return (
    <instancedMesh
      ref={mesh}
      // `count` is the allocation; the effect above sets how many are drawn. Keyed on
      // the count so a larger shape reallocates rather than silently truncating.
      key={field.count}
      args={[undefined, undefined, field.count]}
    >
      <boxGeometry args={[step, step, step]} />
      <meshLambertMaterial color={voxelColor()} />
    </instancedMesh>
  )
}

/**
 * The voxel colour, read from the token layer at runtime.
 *
 * `--accent-rgb` rather than `--accent`, and that is not a preference: `--accent` is
 * `rgb(74 222 128)`, which Three's colour parser does not understand and answers with
 * white. See `./color.ts`, where both of that mistake's forms are pinned by tests.
 *
 * Deliberately **not** derived from the pattern's blocks. A block-id-to-colour table
 * would be game data living outside `src/data/`, and it would be wrong the moment a
 * version added a block.
 */
function voxelColor(): Color | undefined {
  return tokenColor('--accent-rgb')
}

/** A value that only updates once its input has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  const source = JSON.stringify(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
    // Keyed on the serialized value: `value` is a fresh object every render, so
    // depending on it directly would reset the timer forever and never settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, ms])

  return settled
}
