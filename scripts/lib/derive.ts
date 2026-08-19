import { lookupParser } from '../../src/data/authored/parsers'
import { REF_ANY, type CommandDefinition, type Node } from '../../src/schema/types'

/**
 * Turn mcmeta's Brigadier summary into command definitions.
 *
 * Brigadier describes shape and never semantics, so this produces skeletons: the node
 * tree, the argument types, and which arguments are optional. Everything that makes a
 * generator worth using — the data-component editor behind `minecraft:item_stack`,
 * the text-component tree behind `minecraft:component` — is authored elsewhere.
 */

/** A node in mcmeta's summary format. */
export interface BrigadierNode {
  type: 'root' | 'literal' | 'argument'
  children?: Record<string, BrigadierNode>
  executable?: boolean
  parser?: string
  properties?: Record<string, unknown>
  redirect?: string[]
}

export interface DeriveResult {
  definitions: Record<string, CommandDefinition>
  /** Deep parsers that fell back to raw_text, recorded rather than swallowed. */
  gaps: { command: string; argument: string; parser: string }[]
}

/**
 * `redirect` carries two unrelated meanings, told apart by shape rather than by name.
 *
 *   alias      a depth-1 childless literal pointing at another root command:
 *              tell -> msg, w -> msg, tm -> teammsg, tp -> teleport, xp -> experience.
 *              /tell *is* /msg, so it becomes an entry in the target's `aliases`
 *              rather than a definition of its own.
 *
 *   recursion  a node pointing back at the root of the command it sits in. All 103 of
 *              these are inside /execute, and they are what makes clauses chain.
 *              They close a Repeat.
 *
 * Resolving both to Repeat — which the phrase "resolve redirect into Repeat" invites —
 * would turn /tell into a command that repeats itself.
 */
function isAlias(node: BrigadierNode, depth: number, roots: Set<string>): string | undefined {
  if (depth !== 1 || node.children || node.type !== 'literal') return undefined
  const target = node.redirect?.length === 1 ? node.redirect[0] : undefined
  return target && roots.has(target) ? target : undefined
}

/**
 * Does this subtree reach a redirect back to its own command root?
 *
 * Only such children participate in the Repeat; the rest are the command's tail.
 * For /execute that separates the 13 chaining clauses from the terminal `run`.
 */
function recursesToRoot(node: BrigadierNode, root: string): boolean {
  if (node.redirect?.length === 1 && node.redirect[0] === root) return true
  return Object.values(node.children ?? {}).some((child) => recursesToRoot(child, root))
}

/** Whether this subtree contains any node the command may end on. */
function isExecutable(node: BrigadierNode): boolean {
  if (node.executable) return true
  return Object.values(node.children ?? {}).some(isExecutable)
}

/**
 * Splice nested Sequences into their parent, and unwrap one-node ones.
 *
 * The walk builds a Sequence per chain link, so /give arrives as
 * Sequence[give, Sequence[targets, Sequence[item, count]]] — correct, but not the
 * shape command-schema.md's worked example specifies, and #4's acceptance is that the
 * two match. Nesting is not cosmetic either: values are keyed by path, so an extra
 * wrapper turns /2 into /1/1/0 and deepens every editor the renderer lays out.
 */
function flatten(node: Node): Node {
  switch (node.kind) {
    case 'sequence': {
      const nodes = node.nodes.flatMap((child) => {
        const f = flatten(child)
        return f.kind === 'sequence' ? f.nodes : [f]
      })
      return nodes.length === 1 ? nodes[0]! : { kind: 'sequence', nodes }
    }
    case 'choice': {
      const nodes = node.nodes.map(flatten)
      // A one-branch Choice is redundant and gets unwrapped — unless it is optional,
      // where the wrapper is the whole point: it is what says "this clause, or
      // nothing", and unwrapping it would make the clause mandatory again.
      if (nodes.length === 1 && !node.optional) return nodes[0]!
      return { ...node, nodes }
    }
    case 'repeat':
      return { ...node, node: flatten(node.node) }
    default:
      return node
  }
}

export function deriveCommands(tree: BrigadierNode, version: string): DeriveResult {
  const roots = new Set(Object.keys(tree.children ?? {}))
  const definitions: Record<string, CommandDefinition> = {}
  const aliases: Record<string, string[]> = {}
  const gaps: DeriveResult['gaps'] = []

  for (const [name, node] of Object.entries(tree.children ?? {})) {
    const target = isAlias(node, 1, roots)
    if (target) {
      ;(aliases[target] ??= []).push(name)
      continue
    }
    definitions[`vanilla:${name}`] = deriveOne(name, node, version, gaps)
  }

  for (const [target, names] of Object.entries(aliases)) {
    const definition = definitions[`vanilla:${target}`]
    if (!definition) {
      throw new Error(`alias target /${target} is not a command — mcmeta shape changed`)
    }
    definition.aliases = names.sort()
  }

  return { definitions, gaps }
}

function deriveOne(
  name: string,
  node: BrigadierNode,
  version: string,
  gaps: DeriveResult['gaps'],
): CommandDefinition {
  const ctx = { root: name, command: name, gaps }
  const children = node.children ?? {}

  // Children whose subtree loops back become one Repeat(Choice(...)); the rest follow
  // it as the command's tail. Only /execute has any, but the rule is written from the
  // shape so a future command with the same structure needs no new code.
  const chaining = Object.entries(children).filter(([, child]) => recursesToRoot(child, name))
  const tail = Object.entries(children).filter(([, child]) => !recursesToRoot(child, name))

  const parts: Node[] = [{ kind: 'literal', token: name }]

  if (chaining.length > 0) {
    parts.push({
      kind: 'repeat',
      min: 0,
      node: choiceOf(chaining, ctx, node.executable ?? false),
    })
    // The tail sits after zero or more clauses, so its optionality is decided by the
    // clauses beside it rather than by the root above it. /execute's own root is not
    // executable — `/execute` alone is not a command — but all 38 of its `if`/`unless`
    // leaves are, so `/execute if block ~ ~ ~ stone` is finished and `run <command>` is
    // a tail the user may skip. Reading the root's flag alone made `run` mandatory.
    const tailIsSkippable = (node.executable ?? false) || chaining.some(([, c]) => isExecutable(c))
    const rest = branchesOf(tail, ctx, tailIsSkippable)
    if (rest) parts.push(rest)
  } else {
    const rest = branchesOf(Object.entries(children), ctx, node.executable ?? false)
    if (rest) parts.push(rest)
  }

  return {
    id: `vanilla:${name}`,
    label: `/${name}`,
    dialect: 'vanilla',
    provenance: 'derived',
    versions: { min: version },
    root: flatten(parts.length === 1 ? parts[0]! : { kind: 'sequence', nodes: parts }),
  }
}

interface Ctx {
  root: string
  command: string
  gaps: DeriveResult['gaps']
}

/**
 * One child continues the chain; several become a Choice.
 *
 * `afterExecutable` means the command may already have ended, so everything from here
 * on is skippable. How that gets recorded depends on what the continuation starts
 * with. An argument-led one says it with `ArgumentNode.optional` and needs no wrapper,
 * which is why `/give @p stone` still derives as a flat sequence with an optional
 * `count`. A keyword-led one has no argument to hang it on — `force|normal` after
 * `/particle`'s count, `peaceful|easy|…` after `/difficulty` — and becomes a Choice
 * with `optional` set, a single-branch one when there is only the one clause.
 */
function branchesOf(
  entries: [string, BrigadierNode][],
  ctx: Ctx,
  afterExecutable: boolean,
): Node | undefined {
  if (entries.length === 0) return undefined
  const skippableKeyword = afterExecutable && entries[0]![1].type === 'literal'
  if (entries.length === 1 && !skippableKeyword) {
    return nodeFor(entries[0]![0], entries[0]![1], ctx, afterExecutable)
  }
  return choiceOf(entries, ctx, afterExecutable)
}

function choiceOf(entries: [string, BrigadierNode][], ctx: Ctx, afterExecutable: boolean): Node {
  const nodes = entries
    .map(([name, child]) => nodeFor(name, child, ctx, afterExecutable))
    .filter((n): n is Node => n !== undefined)
  if (nodes.length === 1 && !afterExecutable) return nodes[0]!
  return afterExecutable ? { kind: 'choice', nodes, optional: true } : { kind: 'choice', nodes }
}

function nodeFor(
  name: string,
  node: BrigadierNode,
  ctx: Ctx,
  afterExecutable: boolean,
): Node | undefined {
  // A redirect back to the command root closes the Repeat that contains it: the
  // clause ends here and the chain continues at the top.
  if (node.redirect?.length === 1 && node.redirect[0] === ctx.root && !node.children) {
    return selfNode(name, node, ctx, afterExecutable)
  }
  if (node.redirect) {
    // Never silently skip a node: a skipped one yields a definition that looks valid
    // and emits invalid commands. Anything outside the two known shapes stops the run.
    throw new Error(
      `/${ctx.command}: unexpected redirect ${JSON.stringify(node.redirect)} at "${name}". ` +
        `Only an alias (depth-1 childless literal) and a redirect to the command root ` +
        `are understood — see scripts/lib/derive.ts.`,
    )
  }

  // mcmeta serialises redirect-to-root as a *childless literal*, so /execute's `run`
  // and /return's `run` arrive looking empty rather than pointing anywhere. Matched by
  // shape — childless, not executable, no redirect — rather than by the name `run`,
  // because the name is incidental and the shape is what mcmeta actually guarantees.
  if (node.type === 'literal' && !node.children && !node.executable) {
    return {
      kind: 'sequence',
      nodes: [
        { kind: 'literal', token: name },
        { kind: 'ref', definitionId: REF_ANY },
      ],
    }
  }

  return selfNode(name, node, ctx, afterExecutable)
}

function selfNode(
  name: string,
  node: BrigadierNode,
  ctx: Ctx,
  afterExecutable: boolean,
): Node | undefined {
  const self: Node =
    node.type === 'argument'
      ? argumentNode(name, node, ctx, afterExecutable)
      : { kind: 'literal', token: name }

  // Everything after a node the command may end on is optional.
  const rest = branchesOf(
    Object.entries(node.children ?? {}),
    ctx,
    afterExecutable || (node.executable ?? false),
  )
  if (!rest) return self
  return { kind: 'sequence', nodes: [self, rest] }
}

function argumentNode(name: string, node: BrigadierNode, ctx: Ctx, afterExecutable: boolean): Node {
  if (!node.parser) {
    throw new Error(`/${ctx.command}: argument "${name}" has no parser`)
  }
  // Throws on a parser absent from the table. That is the hard error the failure
  // policy calls for: the deriver does not know what the argument is, so it cannot
  // know whether degrading it is safe.
  const binding = lookupParser(node.parser)

  if (binding.kind === 'deep') {
    ctx.gaps.push({ command: ctx.command, argument: name, parser: node.parser })
  }

  return {
    kind: 'argument',
    name,
    type: binding.type,
    ...(node.properties && Object.keys(node.properties).length > 0
      ? { typeOptions: node.properties }
      : {}),
    ...(afterExecutable ? { optional: true } : {}),
  }
}
