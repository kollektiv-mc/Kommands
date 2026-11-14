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

/** A //generate command read back into what a Reference needs to draw it. */
export type ReadCommand =
  { ok: true; hollow: boolean; pattern: string; expression: string } | { ok: false; reason: string }

/**
 * Read a pasted //generate command: its flags, its blocks and its expression.
 *
 * WorldEdit registers the command as `/generate` with the aliases `/gen` and `/g`
 * (`generate.ts`), typed with a second slash in chat. Flags come first, then one
 * pattern word, then the expression, which may hold spaces. Only `-h` changes what is
 * drawn; the origin flags move where it lands in the world, which a reference beside
 * this build places by hand.
 */
export function readGenerate(text: string): ReadCommand {
  const words = text.trim().split(/\s+/)
  if (!/^\/{1,2}(generate|gen|g)$/i.test(words[0] ?? '')) {
    return { ok: false, reason: 'Not a //generate command' }
  }
  let i = 1
  const flags = new Set<string>()
  while (/^-[a-z]+$/i.test(words[i] ?? '')) {
    for (const flag of words[i]!.slice(1)) flags.add(flag.toLowerCase())
    i++
  }
  const pattern = words[i] ?? ''
  const expression = words.slice(i + 1).join(' ')
  if (pattern === '' || expression === '') {
    return { ok: false, reason: 'Needs blocks and an expression' }
  }
  return { ok: true, hollow: flags.has('h'), pattern, expression }
}
