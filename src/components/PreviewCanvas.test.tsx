import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { expect, test, vi } from 'vitest'
import type { RegistryLookup } from '../data/versions/types'
import type { PreviewModule, PreviewStatus } from '../previews/types'
import { PreviewCanvas } from './PreviewCanvas'

/**
 * The shell around a preview, and the promise it makes: **failure degrades, never
 * blocks.**
 *
 * `<PreviewStage>` is mocked, and that is the point rather than a shortcut. jsdom has no
 * WebGL, so mounting the real one would assert nothing about this file and would fail
 * for a reason unrelated to it. What is testable here is everything the shell owns —
 * the placeholder, the status line, and the boundary — and all of it is DOM.
 *
 * A test that needed a GPU would be a test that gets skipped, and a skipped check is not
 * a passing one.
 */
vi.mock('./PreviewStage', () => ({
  default: ({
    module,
    report,
  }: {
    module: PreviewModule
    report: (status: PreviewStatus) => void
  }) => {
    if (module.id === 'test/throws') throw new Error('the module blew up while rendering')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      report({
        message: module.id === 'test/empty' ? 'Enter an expression to see the shape.' : undefined,
        diagnostics: [{ severity: 'warning', message: 'this preview cannot draw perlin' }],
        cap: '32³ samples',
      })
    }, [module.id, report])
    return <div data-testid="stage" />
  },
}))

const registry: RegistryLookup = { entries: () => [], has: () => false }

const moduleWith = (id: string): PreviewModule => ({
  id,
  load: () => Promise.resolve({ default: () => null }),
  accepts: () => true,
})

const draw = (id: string) =>
  render(<PreviewCanvas module={moduleWith(id)} values={{}} registry={registry} />)

test('the panel says it is loading before the renderer has arrived', () => {
  draw('test/ok')
  // Three.js is a dynamic import, so there is always a moment with no renderer. Saying
  // so beats an empty box that looks like a preview which drew nothing.
  expect(screen.getByText(/loading the preview/i)).toBeDefined()
})

test('once the stage mounts it reports the cap, and the cap is shown', async () => {
  draw('test/ok')
  // docs/health-checklist.md § 4 wants the cap surfaced, not merely applied: a preview
  // that quietly shrinks the volume misrepresents the command being generated.
  expect(await screen.findByText('32³ samples')).toBeDefined()
})

test('a module with nothing to draw explains itself over an empty canvas', async () => {
  draw('test/empty')
  expect(await screen.findByText('Enter an expression to see the shape.')).toBeDefined()
})

test('diagnostics are shown rather than swallowed', async () => {
  draw('test/ok')
  expect(await screen.findByText(/cannot draw perlin/)).toBeDefined()
})

test('a module that throws degrades to a message instead of taking the page down', async () => {
  // React logs a caught render error, which is noise here rather than a failure.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    draw('test/throws')
    expect(await screen.findByText(/could not be drawn/i)).toBeDefined()
    // The half that matters: the command is the product and the preview is an aid.
    expect(screen.getByText(/command is unaffected/i)).toBeDefined()
  } finally {
    quiet.mockRestore()
  }
})
