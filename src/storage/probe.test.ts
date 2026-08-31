import { afterEach, expect, test, vi } from 'vitest'
import { configureProbe, probeLocalBackend, probedBackend } from './probe'
import { resolveStorage } from './index'

/** The answer the shell's /api/capabilities actually sends (shell/api). */
const CAPABILITIES = {
  app: 'kommands',
  shell: { version: '0.1.0-test' },
  storage: { kind: 'file' },
  konnekt: { present: true },
}

function answering(body: BodyInit, init?: ResponseInit): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, init)),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  configureProbe(null)
})

test('a capabilities answer marks the local backend present', async () => {
  answering(JSON.stringify(CAPABILITIES))
  await probeLocalBackend()
  expect(probedBackend()).toEqual({ shellVersion: '0.1.0-test', konnektPresent: true })
})

test('the SPA fallback is not a backend', async () => {
  // A static host answers unknown paths with index.html and status 200, so a
  // successful request proves nothing — the body has to identify itself.
  answering('<!doctype html><title>Kommands</title>', {
    headers: { 'Content-Type': 'text/html' },
  })
  await probeLocalBackend()
  expect(probedBackend()).toBeNull()
})

test('a JSON answer that is not the capabilities shape is not a backend', async () => {
  // Another app on the same origin, or a proxy's JSON error page.
  answering(JSON.stringify({ app: 'something-else', storage: { kind: 'file' } }))
  await probeLocalBackend()
  expect(probedBackend()).toBeNull()
})

test('a failed request is "no backend", never a thrown error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('network unreachable')
    }),
  )
  await expect(probeLocalBackend()).resolves.toBeUndefined()
  expect(probedBackend()).toBeNull()
})

test('a non-ok status is "no backend"', async () => {
  answering('not found', { status: 404 })
  await probeLocalBackend()
  expect(probedBackend()).toBeNull()
})

test('resolveStorage answers with the file backend once the probe has found one', () => {
  configureProbe({ shellVersion: '0.1.0-test', konnektPresent: false })
  expect(resolveStorage()?.kind).toBe('file')
  // And without one, the decision falls back to the web path.
  configureProbe(null)
  expect(resolveStorage()?.kind).toBe('local')
})
