import { useEffect, useMemo, useRef, useState } from 'react'
import { shapeVoxels, type VoxelField } from '../../../previews/worldedit/shape/voxels'
import { readGenerate } from '../../../worldedit/stack/command'
import type { VoxelReply, VoxelRequest } from './useVoxels'

/** A Reference's command as the view draws it, or why it draws nothing. */
export type ReferenceVoxels =
  | { state: 'ready'; field: VoxelField; pattern: string }
  | { state: 'pending' }
  | { state: 'failed'; reason: string }

const CACHE_LIMIT = 40

/**
 * The blocks each Reference's command places, evaluated in a worker of their own.
 *
 * Separate from the build's own worker, so adding a template with three references or
 * raising the resolution never holds up the build's picture. Answers are kept by
 * command and size, so a reference is evaluated once however often the view redraws,
 * and a reference shown again after being hidden is drawn at once.
 *
 * Where there is no `Worker` (jsdom) it evaluates in place.
 */
export function useReferenceVoxels(
  commands: readonly string[],
  size: number,
): ReadonlyMap<string, ReferenceVoxels> {
  const local = typeof Worker === 'undefined'
  const [answers, setAnswers] = useState<ReadonlyMap<string, ReferenceVoxels>>(() => new Map())
  const worker = useRef<Worker | null>(null)
  /** Asked and not yet answered, by request id. */
  const asked = useRef(new Map<number, { key: string; pattern: string }>())
  const next = useRef(0)

  useEffect(() => {
    if (local) return
    const w = new Worker(new URL('./voxels.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (event: MessageEvent<VoxelReply>) => {
      const reply = event.data
      const request = asked.current.get(reply.id)
      if (request === undefined) return
      asked.current.delete(reply.id)
      const value: ReferenceVoxels = reply.ok
        ? {
            state: 'ready',
            field: { size: reply.size, filled: reply.filled, count: reply.count },
            pattern: request.pattern,
          }
        : { state: 'failed', reason: reply.reason }
      setAnswers((previous) => {
        const kept = previous.size > CACHE_LIMIT ? new Map() : new Map(previous)
        return kept.set(request.key, value)
      })
    }
    worker.current = w
    const pending = asked.current
    return () => {
      w.terminate()
      worker.current = null
      // Whatever this worker was asked goes unanswered, and is asked of the next one.
      pending.clear()
    }
  }, [local])

  const wanted = useMemo(() => [...new Set(commands)], [commands])

  useEffect(() => {
    const w = worker.current
    if (w === null) return
    const waiting = new Set([...asked.current.values()].map((r) => r.key))
    for (const command of wanted) {
      const key = keyOf(size, command)
      const read = readGenerate(command)
      if (!read.ok || answers.has(key) || waiting.has(key)) continue
      const id = ++next.current
      asked.current.set(id, { key, pattern: read.pattern })
      w.postMessage({
        id,
        source: read.expression,
        size,
        hollow: read.hollow,
      } satisfies VoxelRequest)
    }
  }, [wanted, size, answers])

  return useMemo(() => {
    const out = new Map<string, ReferenceVoxels>()
    for (const command of wanted) {
      const read = readGenerate(command)
      if (!read.ok) out.set(command, { state: 'failed', reason: read.reason })
      else if (local) out.set(command, evaluateHere(read, size))
      else out.set(command, answers.get(keyOf(size, command)) ?? { state: 'pending' })
    }
    return out
  }, [wanted, size, answers, local])
}

const keyOf = (size: number, command: string) => `${size}|${command}`

function evaluateHere(
  read: { pattern: string; expression: string; hollow: boolean },
  size: number,
): ReferenceVoxels {
  const result = shapeVoxels(read.expression, size, read.hollow)
  return result.ok
    ? { state: 'ready', field: result.field, pattern: read.pattern }
    : { state: 'failed', reason: result.reason }
}
