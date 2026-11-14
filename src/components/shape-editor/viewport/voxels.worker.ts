import { shapeVoxels } from '../../../previews/worldedit/shape/voxels'
import type { VoxelRequest, VoxelReply } from './useVoxels'

/**
 * The shape editor's evaluator, off the main thread.
 *
 * 128³ is two million evaluations, which would freeze the page for a second or more on
 * every edit. Here it only delays the picture, and a newer request supersedes the
 * answer to an older one where the answers arrive.
 */
self.onmessage = (event: MessageEvent<VoxelRequest>) => {
  const { id, source, size, hollow } = event.data
  const result = shapeVoxels(source, size, hollow, MAX_EDITOR_SIZE)
  const reply: VoxelReply = result.ok
    ? {
        id,
        ok: true,
        size: result.field.size,
        filled: result.field.filled,
        count: result.field.count,
      }
    : { id, ok: false, reason: result.reason }
  if (reply.ok) self.postMessage(reply, { transfer: [reply.filled.buffer] })
  else self.postMessage(reply)
}

const MAX_EDITOR_SIZE = 128
