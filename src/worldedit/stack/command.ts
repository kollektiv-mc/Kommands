import { DEFAULT_PATTERN } from '../../data/authored/generate'
import type { Diagnostic } from '../../schema/types'
import { compileTree, simplify } from '../csg'
import type { Layer } from './layers'
import { lowerLayers } from './lower'

/**
 * The //generate command a layer stack writes, and what can be said about it.
 *
 * Chat takes 256 characters, a command block 32,500 (`docs/generate-editor.md`), so the
 * editor says which of the two the command fits. `shared` is how many parts the
 * compiler wrote once and used again, each one an assignment ahead of the predicate.
 */

export const CHAT_LIMIT = 256
export const COMMAND_BLOCK_LIMIT = 32_500

/** Round numbers keeps this many significant digits. */
export const ROUND_DIGITS = 4

export interface StackCommand {
  /** The whole command, ready to paste. */
  text: string
  /** The expression alone: what the preview evaluates. Empty when there is no shape. */
  expression: string
  diagnostics: readonly Diagnostic[]
  shared: number
  fits: 'chat' | 'command block' | 'neither'
}

export interface CommandInput {
  layers: readonly Layer[]
  pattern: string
  hollow: boolean
  round: boolean
}

export function stackCommand({ layers, pattern, hollow, round }: CommandInput): StackCommand {
  const compiled = compileTree(
    simplify(lowerLayers(layers)),
    round ? { precision: ROUND_DIGITS } : {},
  )
  const expression = compiled.source === '0' ? '' : compiled.source
  const words = [
    '//generate',
    ...(hollow ? ['-h'] : []),
    pattern.trim() || DEFAULT_PATTERN,
    expression,
  ]
  const text = words.filter((w) => w !== '').join(' ')
  const shared = expression === '' ? 0 : expression.split(';').length - 1
  const fits =
    text.length <= CHAT_LIMIT
      ? 'chat'
      : text.length <= COMMAND_BLOCK_LIMIT
        ? 'command block'
        : 'neither'
  return { text, expression, diagnostics: compiled.diagnostics, shared, fits }
}
