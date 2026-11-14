import { useEffect, useMemo, useRef, useState } from 'react'
import { shapeVoxels, type VoxelField } from '../../../previews/worldedit/shape/voxels'

export interface VoxelRequest {
  id: number
  source: string
  size: number
  hollow: boolean
}

export type VoxelReply =
  | { id: number; ok: true; size: number; filled: Uint8Array; count: number }
  | { id: number; ok: false; reason: string }

export interface Voxels {
  field: VoxelField | null
  /** Why nothing is drawn, when nothing is. */
  reason: string | null
  /** A newer answer is on its way. */
  pending: boolean
}

/** The largest size the editor previews at, matching the worker's cap. */
export const EDITOR_MAX_SIZE = 128

/**
 * The expression's blocks, evaluated in a worker and kept until the next answer lands,
 * so the picture never blinks empty between two edits.
 *
 * Where there is no `Worker` (jsdom, in the tests) it evaluates in place, capped at the
 * preview module's own size.
 */
export function useVoxels(source: string, size: number, hollow: boolean): Voxels {
  const key = `${size}|${hollow ? 'h' : ''}|${source}`
  const empty = source.trim() === ''
  const local = typeof Worker === 'undefined'
  // The worker's latest answer, and the request it answers.
  const [answer, setAnswer] = useState<{ key: string; voxels: Voxels } | null>(null)
  const worker = useRef<Worker | null>(null)
  const latest = useRef({ id: 0, key: '' })
  /**
   * One request at a time: while one is out, only the newest waits behind it. A gizmo
   * drag asks on every frame, and a queue of all of them would keep the worker on
   * pictures nobody will see.
   */
  const flight = useRef<{ busy: boolean; next: VoxelRequest | null }>({ busy: false, next: null })

  useEffect(() => {
    if (local) return
    const w = new Worker(new URL('./voxels.worker.ts', import.meta.url), { type: 'module' })
    const sent = flight.current
    const sendNext = () => {
      sent.busy = sent.next !== null
      if (sent.next !== null) w.postMessage(sent.next)
      sent.next = null
    }
    // A request that throws gets no answer; the next one still goes.
    w.onerror = sendNext
    w.onmessage = (event: MessageEvent<VoxelReply>) => {
      const reply = event.data
      sendNext()
      if (reply.id !== latest.current.id) return
      const voxels: Voxels = reply.ok
        ? {
            field: { size: reply.size, filled: reply.filled, count: reply.count },
            reason: null,
            pending: false,
          }
        : { field: null, reason: reply.reason, pending: false }
      setAnswer({ key: latest.current.key, voxels })
    }
    worker.current = w
    return () => {
      w.terminate()
      worker.current = null
      sent.busy = false
      sent.next = null
    }
  }, [local])

  useEffect(() => {
    const w = worker.current
    if (empty || w === null) return
    const id = latest.current.id + 1
    latest.current = { id, key }
    const request: VoxelRequest = { id, source, size, hollow }
    if (flight.current.busy) flight.current.next = request
    else {
      flight.current.busy = true
      w.postMessage(request)
    }
  }, [empty, key, source, size, hollow])

  const inPlace = useMemo(() => {
    if (!local || empty) return null
    const result = shapeVoxels(source, size, hollow)
    return result.ok
      ? { field: result.field, reason: null, pending: false }
      : { field: null, reason: result.reason, pending: false }
  }, [local, empty, source, size, hollow])

  if (empty) return { field: null, reason: 'No shapes yet', pending: false }
  if (inPlace !== null) return inPlace
  if (answer === null) return { field: null, reason: null, pending: true }
  return answer.key === key ? answer.voxels : { ...answer.voxels, pending: true }
}
