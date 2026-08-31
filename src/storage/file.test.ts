import { expect, test, vi } from 'vitest'
import type { SavedCommand } from '../schema/saved'
import { fileBackend } from './file'

const SAVED: SavedCommand = {
  id: 'cmd-1',
  name: 'Kit',
  definitionId: 'vanilla:give',
  version: '1.21.1',
  preview: '/give @p stone',
  revision: 1,
  createdAt: '2026-08-31T10:00:00Z',
  updatedAt: '2026-08-31T10:00:00Z',
  value: { args: {}, flags: {}, choices: {}, repeats: {}, refs: {} },
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

function answering(response: Response): { fetcher: Fetcher; calls: [string, RequestInit?][] } {
  const calls: [string, RequestInit?][] = []
  return {
    calls,
    fetcher: async (input, init) => {
      calls.push([input, init])
      return response
    },
  }
}

test('list reads the envelope and drops what it cannot read', async () => {
  const { fetcher, calls } = answering(
    new Response(
      JSON.stringify({
        version: 1,
        commands: [SAVED, { id: 'future', shape: 'unknown' }],
      }),
    ),
  )
  const listed = await fileBackend(fetcher).list()
  expect(calls).toEqual([['/api/saved-commands', undefined]])
  expect(listed).toEqual([SAVED])
})

test('put sends the whole command to its id', async () => {
  const { fetcher, calls } = answering(new Response(null, { status: 204 }))
  await fileBackend(fetcher).put(SAVED)
  const [url, init] = calls[0]
  expect(url).toBe('/api/saved-commands/cmd-1')
  expect(init?.method).toBe('PUT')
  expect(JSON.parse(init?.body as string)).toEqual(SAVED)
})

test('remove deletes by id, and an absent id is not an error', async () => {
  // The backend answers 204 for an absent id (shell/api), so this is the whole
  // contract: not-ok is a real failure, never a "was already gone".
  const { fetcher, calls } = answering(new Response(null, { status: 204 }))
  await fileBackend(fetcher).remove('cmd-1')
  expect(calls).toEqual([['/api/saved-commands/cmd-1', { method: 'DELETE' }]])
})

test('an id is carried safely through the path', async () => {
  const { fetcher, calls } = answering(new Response(null, { status: 204 }))
  await fileBackend(fetcher).remove('odd/id?x=1')
  expect(calls[0][0]).toBe('/api/saved-commands/odd%2Fid%3Fx%3D1')
})

test("a failed write surfaces the backend's own message", async () => {
  const { fetcher } = answering(
    new Response(JSON.stringify({ error: 'saved commands are unreadable: parse store' }), {
      status: 500,
    }),
  )
  await expect(fileBackend(fetcher).put(SAVED)).rejects.toThrow(
    'saved commands are unreadable: parse store',
  )
})

test('a failure without a message still says what answered', async () => {
  const { fetcher } = answering(new Response('<html>proxy error</html>', { status: 502 }))
  await expect(fileBackend(fetcher).list()).rejects.toThrow('the local backend answered 502')
})

test('the default fetcher wraps the global rather than aliasing it', async () => {
  // An unbound `fetch` reference throws in browsers that insist on their own `this`;
  // the default parameter has to survive the global being swapped after construction.
  const seen: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      seen.push(String(input))
      return new Response(JSON.stringify({ version: 1, commands: [] }))
    }),
  )
  try {
    const listed = await fileBackend().list()
    expect(seen).toEqual(['/api/saved-commands'])
    expect(listed).toEqual([])
  } finally {
    vi.unstubAllGlobals()
  }
})
