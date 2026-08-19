import type { SerializeContext } from '../data/versions/types'
import { lookupArgumentType } from './argument-types'
import {
  branch,
  child,
  instance,
  repeatCount,
  ROOT,
  type ChoiceSelections,
  type Path,
  type RepeatCounts,
} from './paths'
import { REF_ANY, type CommandDefinition, type Node } from './types'

/** Everything the user has entered for one command. Keyed by path — see paths.ts. */
export interface CommandValue {
  args: Readonly<Record<Path, unknown>>
  flags: Readonly<Record<Path, boolean>>
  choices: ChoiceSelections
  repeats: RepeatCounts
  /** Which definition a Ref resolves to, for `@any` refs. */
  refs: Readonly<Record<Path, string>>
}

export const EMPTY_VALUE: CommandValue = { args: {}, flags: {}, choices: {}, repeats: {}, refs: {} }

export interface SerializeOptions {
  /** Resolves a Ref to a definition. Returns undefined for an unknown id. */
  resolve?: (id: string) => CommandDefinition | undefined
  /**
   * Guards against a Ref cycle that never passes through a Repeat.
   *
   * command-schema.md invariant 5 forbids that shape, but a definition is data and
   * data can be wrong — derived from a future mcmeta, or hand-authored in a PR. A
   * depth cap turns "the tab freezes" into "the output stops", which is a bug report
   * someone can act on.
   */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 16

/**
 * Turn a definition and its values into command text.
 *
 * Every branch here is on the *shape* of a node or on a trait from ctx. There is no
 * branch on a command id — that is what makes this one function rather than one per
 * command — and none on a version number, which ctx makes impossible by not carrying
 * one.
 */
export function serializeCommand(
  definition: CommandDefinition,
  value: CommandValue,
  ctx: SerializeContext,
  options: SerializeOptions = {},
): string {
  const depth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const body = serializeNode(definition.root, ROOT, value, ctx, options, depth)
  // WorldEdit tokens carry their own slashes ('//generate'); vanilla literals are
  // bare, so the prefix is added here. This branches on dialect, which is a schema
  // field — not on a command id.
  const prefix = definition.dialect === 'vanilla' ? '/' : ''
  return body === '' ? '' : prefix + body
}

function serializeNode(
  node: Node,
  path: Path,
  value: CommandValue,
  ctx: SerializeContext,
  options: SerializeOptions,
  depth: number,
): string {
  if (depth <= 0) return ''

  switch (node.kind) {
    case 'literal':
      return node.token

    case 'argument': {
      const type = lookupArgumentType(node.type)
      // Fall back to the type's default, exactly as ArgumentView does when it decides
      // what to display. Reading the raw value alone meant an untouched field showed
      // '@p' while the output said '/give' — the form and the command disagreeing
      // about what the command is, which is the one thing this panel must not do.
      const raw = value.args[path] ?? type.defaultValue(node.typeOptions ?? {})
      const text = type.serialize(raw, ctx)
      // An unfilled *required* argument becomes a visible placeholder rather than an
      // empty string. Empty was the one shape that could not be shown honestly: at the
      // end of a command it vanished, so `/tellraw @p` looked like a finished command
      // that says nothing; in the middle it left two spaces, which is not a visible
      // gap either — just malformed text that reads as valid. Angle brackets are
      // Brigadier's own usage-string convention, so the gap reads as a gap.
      return text === '' && !node.optional ? `<${node.name}>` : text
    }

    case 'sequence': {
      const parts = node.nodes.map((n, i) =>
        serializeNode(n, child(path, i), value, ctx, options, depth),
      )
      // Trailing empties are dropped, which is how an unfilled optional tail
      // disappears: `/give @p stone` rather than `/give @p stone `. Only optional
      // arguments can be empty here now — a required one carries its placeholder — so
      // this no longer swallows a gap that mattered, and the doubled space a middle
      // gap used to leave is gone with it.
      while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
      return parts.join(' ').trim()
    }

    case 'choice': {
      const selected = value.choices[path] ?? 0
      const chosen = node.nodes[selected]
      if (!chosen) return ''
      return serializeNode(chosen, branch(path, selected), value, ctx, options, depth)
    }

    case 'repeat': {
      const count = repeatCount(value.repeats, path, node)
      const parts: string[] = []
      for (let i = 0; i < count; i++) {
        const part = serializeNode(node.node, instance(path, i), value, ctx, options, depth)
        if (part !== '') parts.push(part)
      }
      return parts.join(' ')
    }

    case 'flagset': {
      // One combined token: -hro, never -h -r -o.
      const chars = node.flags.filter((f) => value.flags[`${path}/${f.name}`]).map((f) => f.char)
      return chars.length > 0 ? `-${chars.join('')}` : ''
    }

    case 'ref': {
      const id = node.definitionId === REF_ANY ? value.refs[path] : node.definitionId
      if (!id || !options.resolve) return ''
      const target = options.resolve(id)
      if (!target) return ''
      // Depth decrements only here. A Ref is the only node that can reach a
      // definition again, so it is the only place a cycle can be spent.
      const inner = serializeNode(target.root, path, value, ctx, options, depth - 1)
      return inner
    }
  }
}
