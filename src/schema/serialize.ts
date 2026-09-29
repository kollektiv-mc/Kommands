import type { SerializeContext } from '../data/versions/types'
import { argumentOptions, lookupArgumentType } from './argument-types'
import {
  branch,
  child,
  choiceSelection,
  instance,
  NO_BRANCH,
  repeatInstances,
  ROOT,
  type ChoiceSelections,
  type Path,
  type RepeatInstances,
} from './paths'
import { REF_ANY, type CommandDefinition, type Node } from './types'

/** Everything the user has entered for one command. Keyed by path — see paths.ts. */
export interface CommandValue {
  args: Readonly<Record<Path, unknown>>
  flags: Readonly<Record<Path, boolean>>
  choices: ChoiceSelections
  repeats: RepeatInstances
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
  return serializeWithReport(definition, value, ctx, options).text
}

/**
 * An optional argument the output had to write although it was left empty.
 *
 * Brigadier reads arguments by position, so when a later part of the same sequence is
 * set, an empty one before it cannot simply be dropped: the later value would slide
 * into its slot. It is written as its authored game default when it has one
 * (`'default'`), and as its `<name>` placeholder when it does not (`'placeholder'`).
 */
export interface ForcedSlot {
  how: 'default' | 'placeholder'
  /** What was written in the argument's place. */
  text: string
}

export interface SerializeReport {
  text: string
  /** Every argument written because a later one needed its slot, by path. */
  forced: ReadonlyMap<Path, ForcedSlot>
}

/**
 * The command text, and which empty arguments had to be written to produce it.
 *
 * One walk for both, because the second answer is a by-product of the first: the form
 * says "written as 0 because a later value is set" beside exactly the fields the
 * output filled, and computing that separately would be a second copy of the rule
 * that could disagree with the first.
 */
export function serializeWithReport(
  definition: CommandDefinition,
  value: CommandValue,
  ctx: SerializeContext,
  options: SerializeOptions = {},
): SerializeReport {
  const forced = new Map<Path, ForcedSlot>()
  const depth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const body = serializeNode(definition.root, ROOT, value, ctx, { ...options, forced }, depth)
  return { text: body === '' ? '' : dialectPrefix(definition.dialect) + body, forced }
}

interface WalkOptions extends SerializeOptions {
  forced?: Map<Path, ForcedSlot>
}

/**
 * The slash a dialect's tokens are written with.
 *
 * WorldEdit tokens carry their own — `//generate` is the literal — while vanilla
 * literals are bare and take one here. Branching on dialect is fine; it is a schema
 * field, not a command id.
 *
 * Exported because the serializer is not the only reader. The command page prints a
 * command's other names, and applying the vanilla rule to a WorldEdit alias produced
 * `///gen`. One rule with two callers beats the same conditional written twice, which
 * is how that happened.
 */
export function dialectPrefix(dialect: CommandDefinition['dialect']): string {
  return dialect === 'vanilla' ? '/' : ''
}

/**
 * A command's other names, as written.
 *
 * Aliases are stored the way their dialect stores its tokens — mcmeta gives vanilla's
 * bare (`xp`), a WorldEdit definition writes its own with the slashes it has in game
 * (`//gen`) — so the prefix is applied by the same rule the command name gets.
 */
export function aliasNames(definition: CommandDefinition): string[] {
  const prefix = dialectPrefix(definition.dialect)
  return (definition.aliases ?? []).map((alias) => `${prefix}${alias}`)
}

function serializeNode(
  node: Node,
  path: Path,
  value: CommandValue,
  ctx: SerializeContext,
  options: WalkOptions,
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
      const raw = value.args[path] ?? type.defaultValue(argumentOptions(node))
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
      // An empty part is dropped when nothing after it is set. An unfilled optional
      // tail disappearing is what gives `/give @p stone` rather than `/give @p stone `,
      // and an unselected optional clause leaving nothing behind is what stops a
      // doubled space, which is not a visible gap, just malformed text that reads as
      // valid.
      //
      // An empty *argument* with something set after it is different, and dropping it
      // too was a bug: Brigadier reads arguments by position, so the later value slid
      // into its slot. `/effect give @p speed` with only an amplifier came out as
      // `speed 2 false`, a two-second effect. So an argument before the last part that
      // says anything is written as the game's own default for it, or as its `<name>`
      // placeholder when the game documents none. A keyword-led part (an unselected
      // clause, an empty repeat, no flags) is still dropped: it has no position to hold.
      const parts = node.nodes.map((n, i) =>
        serializeNode(n, child(path, i), value, ctx, options, depth),
      )
      let last = -1
      parts.forEach((part, i) => {
        if (part !== '') last = i
      })
      return parts
        .map((part, i) => {
          const n = node.nodes[i]
          if (part !== '' || i > last || n?.kind !== 'argument') return part
          const slot = forcedSlot(n, ctx)
          options.forced?.set(child(path, i), slot)
          return slot.text
        })
        .filter((part) => part !== '')
        .join(' ')
    }

    case 'choice': {
      const selected = choiceSelection(value.choices, path, node)
      // An optional clause with nothing selected contributes nothing — no keyword, no
      // separator. This is the whole reason ChoiceNode carries `optional`.
      if (selected === NO_BRANCH) return ''
      const chosen = node.nodes[selected]
      if (!chosen) return ''
      return serializeNode(chosen, branch(path, selected), value, ctx, options, depth)
    }

    case 'repeat': {
      // The id list is the clause order, so serialization reads it straight through. It
      // used to count and then rebuild each ordinal, which meant the output order and
      // the stored keys had to agree; now there is only one thing to be in order.
      const parts: string[] = []
      for (const id of repeatInstances(value.repeats, path, node)) {
        const part = serializeNode(node.node, instance(path, id), value, ctx, options, depth)
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
      const target = id && options.resolve ? options.resolve(id) : undefined
      // A Ref that is reached at all is required — what is optional is the clause that
      // introduces it. So an unpicked one is a visible gap rather than nothing, for the
      // same reason an unfilled required argument is: `/execute as @a run` reads as a
      // finished command and is not one.
      if (!target) return '<command>'
      // Depth decrements only here. A Ref is the only node that can reach a
      // definition again, so it is the only place a cycle can be spent.
      return serializeNode(target.root, path, value, ctx, options, depth - 1)
    }
  }
}

/** What an empty argument is written as when a later part needs its slot. */
function forcedSlot(node: Extract<Node, { kind: 'argument' }>, ctx: SerializeContext): ForcedSlot {
  if (node.default !== undefined) {
    const text = lookupArgumentType(node.type).serialize(node.default, ctx)
    if (text !== '') return { how: 'default', text }
  }
  return { how: 'placeholder', text: `<${node.name}>` }
}
