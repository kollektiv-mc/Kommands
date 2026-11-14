import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  type Color,
  type Plane,
} from 'three'
import type { ModifierLayer } from '../../../worldedit/stack/layers'
import { bendTip, guideOf } from './guides'

/**
 * A modifier's guide in the view, in its own frame (`guides.ts` draws it). Faint, and
 * clear while selected; a selected Bend also shows the handle at its tip, which drags
 * its angle (`viewPointer.ts`).
 */
export function ModifierGuide({
  layer,
  selected,
  colour,
  clip,
}: {
  layer: ModifierLayer
  selected: boolean
  colour: Color | undefined
  clip: Plane[]
}) {
  const key = JSON.stringify([layer.kind, layer.params])
  const parts = useMemo(() => {
    const guide = guideOf(layer)
    // Each run as segments, one geometry for every run drawn at the same strength.
    const byStrength = new Map<number, number[]>()
    for (const { points, strength } of guide.lines) {
      const out = byStrength.get(strength) ?? []
      for (let i = 1; i < points.length; i++) out.push(...points[i - 1]!, ...points[i]!)
      byStrength.set(strength, out)
    }
    const lines = [...byStrength].map(([strength, flat]) => {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(flat, 3))
      return { geometry, strength }
    })
    let plane: { face: BufferGeometry; edges: BufferGeometry } | null = null
    if (guide.plane !== null) {
      const face = new PlaneGeometry(2.2, 2.2)
      if (guide.plane === 'x') face.rotateY(Math.PI / 2)
      else if (guide.plane === 'y') face.rotateX(-Math.PI / 2)
      plane = { face, edges: new EdgesGeometry(face) }
    }
    return { lines, plane }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what the guide is drawn from
  }, [key])
  useEffect(
    () => () => {
      for (const l of parts.lines) l.geometry.dispose()
      parts.plane?.face.dispose()
      parts.plane?.edges.dispose()
    },
    [parts],
  )
  const strength = selected ? 0.9 : 0.35
  const tip = layer.kind === 'bend' && selected ? bendTip(layer.params) : null

  return (
    <>
      {parts.lines.map(({ geometry, strength: s }) => (
        <lineSegments key={s} geometry={geometry} renderOrder={4}>
          <lineBasicMaterial
            color={colour}
            transparent
            depthWrite={false}
            opacity={strength * s}
            clippingPlanes={clip}
          />
        </lineSegments>
      ))}
      {parts.plane !== null && (
        <>
          <mesh geometry={parts.plane.face} renderOrder={4}>
            <meshBasicMaterial
              color={colour}
              transparent
              depthWrite={false}
              side={DoubleSide}
              opacity={selected ? 0.12 : 0.04}
              clippingPlanes={clip}
            />
          </mesh>
          <lineSegments geometry={parts.plane.edges} renderOrder={4}>
            <lineBasicMaterial
              color={colour}
              transparent
              depthWrite={false}
              opacity={strength}
              clippingPlanes={clip}
            />
          </lineSegments>
        </>
      )}
      {tip !== null && (
        <mesh position={tip} renderOrder={6} userData={{ bend: layer.id }}>
          <sphereGeometry args={[0.05, 16, 10]} />
          <meshBasicMaterial color={colour} depthTest={false} transparent opacity={0.95} />
        </mesh>
      )}
    </>
  )
}
