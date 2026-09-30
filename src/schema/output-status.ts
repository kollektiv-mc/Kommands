import { CHAT_LIMIT, COMMAND_BLOCK_LIMIT } from '../data/authored/limits'
import type { Segment } from './serialize'

/**
 * What the output panel says about the command it shows, in one line that is always
 * there. It replaces warnings that appeared under the output and pushed the form down.
 */
export type OutputStatus =
  | { kind: 'empty' }
  | { kind: 'incomplete'; missing: readonly string[] }
  | { kind: 'chat' | 'command-block' | 'too-long'; length: number; limit: number }

export function outputStatus(segments: readonly Segment[], text: string): OutputStatus {
  if (text === '') return { kind: 'empty' }
  const missing = [
    ...new Set(segments.filter((s) => s.kind === 'placeholder').map((s) => s.text.slice(1, -1))),
  ]
  if (missing.length > 0) return { kind: 'incomplete', missing }
  if (text.length <= CHAT_LIMIT) return { kind: 'chat', length: text.length, limit: CHAT_LIMIT }
  if (text.length <= COMMAND_BLOCK_LIMIT) {
    return { kind: 'command-block', length: text.length, limit: COMMAND_BLOCK_LIMIT }
  }
  return { kind: 'too-long', length: text.length, limit: COMMAND_BLOCK_LIMIT }
}

/** The status as a sentence. Names what is missing rather than counting it, up to two. */
export function statusMessage(status: OutputStatus): string {
  switch (status.kind) {
    case 'empty':
      return 'Nothing to copy yet'
    case 'incomplete': {
      const [first, second, ...rest] = status.missing
      if (second === undefined) return `Needs ${first}`
      if (rest.length === 0) return `Needs ${first} and ${second}`
      return `Needs ${first}, ${second} and ${rest.length} more`
    }
    case 'chat':
      return 'Ready to paste in chat'
    case 'command-block':
      return 'Too long for chat. Use a command block.'
    case 'too-long':
      return 'Too long even for a command block'
  }
}
