import { lazy, Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { RegistryLookup } from '../data/versions/types'
import type { PreviewModule, PreviewStatus } from '../previews/types'

/**
 * The shared canvas: renderer, camera and lights, and nothing command-specific.
 *
 * Split out of `<PreviewCanvas>` because this is the first file that touches
 * `@react-three/fiber`, and `<PreviewCanvas>` must stay reachable from the entry chunk
 * to render the panel at all. Everything here arrives through one dynamic import, so
 * Three.js is downloaded by a session that opens a command with a preview and by no
 * other.
 *
 * Modules contribute scene content only. If a module ever appears to need its own
 * camera or renderer, that is a gap in this file rather than a licence to make one —
 * a second WebGL context is a leak, not a workaround.
 */
export default function PreviewStage({
  module,
  values,
  registry,
  report,
}: {
  module: PreviewModule
  values: Readonly<Record<string, unknown>>
  registry: RegistryLookup
  report: (status: PreviewStatus) => void
}) {
  // Keyed on the module so switching commands mounts the new one rather than handing
  // the old component a different command's values.
  const Content = useMemo(() => lazy(module.load), [module])

  return (
    <Canvas camera={{ position: [2.6, 2.2, 2.6], fov: 45 }}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} />
      <Turntable>
        {/* `null` rather than a spinner: a fallback inside a canvas would have to be
            geometry, and geometry that means "loading" is a thing to explain. The DOM
            placeholder outside the canvas already says it. */}
        <Suspense fallback={null}>
          <Content values={values} registry={registry} report={report} />
        </Suspense>
      </Turntable>
    </Canvas>
  )
}

/**
 * Slowly rotate what the module drew.
 *
 * A shape rendered flat and still reads as a silhouette — a sphere and a disc are the
 * same circle — so this is depth perception rather than decoration. It lives in the
 * stage because it is a property of how previews are *shown*, not of what any one
 * module computes.
 *
 * Honours `prefers-reduced-motion` the way `.claude/rules/styling.md` requires of CSS
 * motion; the media query is unavailable to a render loop, so it is read directly.
 */
function Turntable({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null)
  const still = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useFrame((_, delta) => {
    if (still || group.current === null) return
    group.current.rotation.y += delta * 0.35
  })

  return <group ref={group}>{children}</group>
}
