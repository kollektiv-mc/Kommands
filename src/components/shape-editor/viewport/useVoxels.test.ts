import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useVoxels, type VoxelReply, type VoxelRequest } from './useVoxels'

class FakeWorker {
  static last: FakeWorker | null = null
  asked: VoxelRequest[] = []
  onmessage: ((event: MessageEvent<VoxelReply>) => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    FakeWorker.last = this
  }
  postMessage(request: VoxelRequest) {
    this.asked.push(request)
  }
  terminate() {}
  answer(request: VoxelRequest) {
    const filled = new Uint8Array(request.size ** 3)
    const reply: VoxelReply = { id: request.id, ok: true, size: request.size, filled, count: 0 }
    act(() => this.onmessage?.({ data: reply } as MessageEvent<VoxelReply>))
  }
}

afterEach(() => vi.unstubAllGlobals())

test('only the newest request waits behind the one out', () => {
  vi.stubGlobal('Worker', FakeWorker)
  const { result, rerender } = renderHook(({ src }) => useVoxels(src, 8, false), {
    initialProps: { src: 'x<0' },
  })
  rerender({ src: 'x<0.1' })
  rerender({ src: 'x<0.2' })
  const worker = FakeWorker.last!
  expect(worker.asked.map((r) => r.source)).toEqual(['x<0'])
  worker.answer(worker.asked[0]!)
  expect(worker.asked.map((r) => r.source)).toEqual(['x<0', 'x<0.2'])
  expect(result.current.pending).toBe(true)
  worker.answer(worker.asked[1]!)
  expect(result.current).toMatchObject({ pending: false, reason: null })
})

test('a request that fails in the worker lets the next go', () => {
  vi.stubGlobal('Worker', FakeWorker)
  const { rerender } = renderHook(({ src }) => useVoxels(src, 8, false), {
    initialProps: { src: 'x<0' },
  })
  rerender({ src: 'x<0.5' })
  const worker = FakeWorker.last!
  act(() => worker.onerror?.())
  expect(worker.asked.map((r) => r.source)).toEqual(['x<0', 'x<0.5'])
})
