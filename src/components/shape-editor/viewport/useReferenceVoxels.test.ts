import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useReferenceVoxels } from './useReferenceVoxels'
import type { VoxelReply, VoxelRequest } from './useVoxels'

/** A worker that keeps what it is asked and answers when the test says so. */
class FakeWorker {
  static last: FakeWorker | null = null
  asked: VoxelRequest[] = []
  onmessage: ((event: MessageEvent<VoxelReply>) => void) | null = null
  constructor() {
    FakeWorker.last = this
  }
  postMessage(request: VoxelRequest) {
    this.asked.push(request)
  }
  terminate() {}
  answer(reply: VoxelReply) {
    act(() => this.onmessage?.({ data: reply } as MessageEvent<VoxelReply>))
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('references in the worker', () => {
  test('each command is asked once and kept by size', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const roof = '//generate -h copper_block y>0'
    const { result, rerender } = renderHook(({ cmds }) => useReferenceVoxels(cmds, 16), {
      initialProps: { cmds: [roof, roof] },
    })
    const worker = FakeWorker.last!
    expect(result.current.get(roof)).toEqual({ state: 'pending' })
    expect(worker.asked).toMatchObject([{ source: 'y>0', size: 16, hollow: true }])

    const filled = new Uint8Array(16 ** 3)
    worker.answer({ id: worker.asked[0]!.id, ok: true, size: 16, filled, count: 0 })
    expect(result.current.get(roof)).toMatchObject({ state: 'ready', pattern: 'copper_block' })

    rerender({ cmds: [roof] })
    expect(worker.asked).toHaveLength(1)
  })

  test('a command that is not //generate fails without asking', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { result } = renderHook(() => useReferenceVoxels(['/say hi'], 16))
    expect(result.current.get('/say hi')).toMatchObject({ state: 'failed' })
    expect(FakeWorker.last!.asked).toEqual([])
  })

  test('a failed evaluation says why', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const cmd = '//generate stone x<'
    const { result } = renderHook(() => useReferenceVoxels([cmd], 16))
    const worker = FakeWorker.last!
    worker.answer({ id: worker.asked[0]!.id, ok: false, reason: 'Does not parse' })
    expect(result.current.get(cmd)).toEqual({ state: 'failed', reason: 'Does not parse' })
  })
})
