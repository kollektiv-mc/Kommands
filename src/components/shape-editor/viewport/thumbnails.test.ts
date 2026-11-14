import { Vector3 } from 'three'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TemplateSpec } from '../../../data/authored/generate'
import { forgetPictures, pictureOf, pictureParts } from './thumbnails'
import type { VoxelReply, VoxelRequest } from './useVoxels'

/** Draws nothing, and says what it was asked to draw. */
const drawn = vi.hoisted(() => ({ renders: 0, meshes: 0, disposed: 0 }))
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement = { toDataURL: () => `data:image/png;base64,${drawn.renders}` }
    setPixelRatio() {}
    setSize() {}
    render(scene: InstanceType<typeof three.Scene>) {
      drawn.renders++
      drawn.meshes += scene.children.filter((c) => c instanceof three.Mesh).length
    }
    dispose() {
      drawn.disposed++
    }
    forceContextLoss() {}
  }
  return { ...three, WebGLRenderer }
})

const part = (name: string, block: string) =>
  ({ name, block, part: [{ shape: 'box', name: 'Block', params: { width: 0.5 } }] }) as const

const tower: TemplateSpec = {
  id: 'test-tower',
  name: 'Tower',
  pattern: 'stone',
  layers: [
    { shape: 'cylinder', name: 'Body' },
    { name: 'Roof', pos: [0, 0.5, 0], rot: [0, 90, 0], group: [part('Cap', 'copper_block')] },
    { name: 'Path', group: [part('Steps', 'dirt')] },
  ],
}

afterEach(() => {
  forgetPictures()
  vi.unstubAllGlobals()
  Object.assign(drawn, { renders: 0, meshes: 0, disposed: 0 })
})

describe('what a picture is made of', () => {
  test('its own blocks, then each reference where it sits', () => {
    const parts = pictureParts(tower)
    expect(parts.map((p) => p.pattern)).toEqual(['stone', 'copper_block', 'dirt'])
    expect(parts[0]?.opacity).toBe(1)
    expect(parts[1]?.opacity).toBeLessThan(1)
    const at = new Vector3().setFromMatrixPosition(parts[1]!.matrix)
    expect(at.toArray()).toEqual([0, 0.5, 0])
  })

  test('a template with nothing in it has no parts', () => {
    expect(pictureParts({ ...tower, layers: [] })).toEqual([])
  })
})

describe('the pictures', () => {
  test('each is drawn once and kept by template', async () => {
    const first = pictureOf(tower)
    expect(pictureOf(tower)).toBe(first)
    expect(await first).toMatch(/^data:image\/png/)
    expect(drawn.renders).toBe(1)
    expect(drawn.meshes).toBe(3)
    expect(drawn.disposed).toBe(1)
  })

  test('an empty template has no picture', async () => {
    expect(await pictureOf({ ...tower, id: 'empty', layers: [] })).toBe('')
    expect(drawn.renders).toBe(0)
  })

  test('parts are evaluated in a worker where there is one', async () => {
    const workers: FakeWorker[] = []
    class FakeWorker {
      asked: VoxelRequest[] = []
      onmessage: ((event: MessageEvent<VoxelReply>) => void) | null = null
      terminated = false
      constructor() {
        workers.push(this)
      }
      postMessage(request: VoxelRequest) {
        this.asked.push(request)
      }
      terminate() {
        this.terminated = true
      }
    }
    vi.stubGlobal('Worker', FakeWorker)
    const picture = pictureOf(tower)
    await Promise.resolve()
    const worker = workers[0]!
    expect(worker.asked).toHaveLength(3)
    for (const { id, size } of worker.asked) {
      const filled = new Uint8Array(size ** 3)
      filled[0] = 1
      worker.onmessage?.({ data: { id, ok: true, size, filled, count: 1 } } as MessageEvent)
    }
    expect(await picture).toMatch(/^data:image\/png/)
    expect(drawn.meshes).toBe(3)
    expect(worker.terminated).toBe(true)
  })
})
