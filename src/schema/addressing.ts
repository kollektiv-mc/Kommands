import type { ArgumentTypeKey, Node } from './types'
import { ROOT, STATIC, walk, type Path, type RepeatInstances } from './paths'

/**
 * How a rule names an argument or a flag.
 *
 * `paths.ts` answers "where is this value right now". This module answers the other
 * question — "which node does this name mean" — and they are not the same question,
 * which is the whole of issue #29. A name resolving to several paths is normal: it is
 * one node under a Repeat the user has added three clauses to. A name resolving to
 * several *nodes* is an authoring mistake, and until these were told apart the two
 * were indistinguishable.
 *
 * Derived skeletons carry Brigadier's own argument names, and Brigadier never promised
 * they were unique because it addresses nodes by position. 33 of the 78 derived
 * definitions have a duplicate; `/execute` alone has 36 argument nodes called `scale`.
 * So a bare name is not always enough, and a selector may carry the enclosing keywords
 * that tell two of them apart:
 *
 *     targets                       a bare name, when it means one thing
 *     result/block/byte/scale       the innermost keywords, when it does not
 *     -h                            a flag, which carries its own leading dash
 *
 * The chain is matched as a **suffix**, so a selector never has to spell the command
 * name, and the nearest keyword — the one that actually discriminates — is the one you
 * write. It is a *contiguous* suffix rather than a subsequence: `store/scale` does not
 * name `/execute store result block <pos> <path> byte <scale>`, because `store` is not
 * the keyword immediately above it. Skipping keywords would let one selector mean two
 * unrelated clauses that happen to share an outer word.
 *
 * It is deliberately not a path: `/1/#0/|3/2` is positional and dies the moment the
 * deriver reshapes the tree, and surviving regeneration is the entire reason rules
 * address by name rather than by index.
 *
 * There is no ordinal form (`store/scale#1`), and adding one would give back exactly
 * the positional fragility this avoids. Two commands are therefore unaddressable in
 * part — `/loot` and `/teleport`, 32 argument nodes between them, where Brigadier
 * separates the collisions by position alone and there is no keyword to name. Neither
 * is addressed by anything today. If one ever is, that is when to decide, against a
 * real case.
 */
export interface StaticLocation {
  kind: 'argument' | 'flag'
  name: string
  /**
   * The argument's type key. Absent on a flag, which has no type to carry.
   *
   * Here rather than looked up by a second walk, because the walk that finds a node
   * already has it in hand. A preview module's `accepts` asserts the *types* it depends
   * on — `docs/adding-a-preview.md` is explicit that names alone are not enough — and
   * without this it would have to re-find the node it was just handed.
   */
  type?: ArgumentTypeKey
  /** The enclosing literal chain, outermost first. */
  literals: readonly string[]
}

interface Located extends StaticLocation {
  path: Path
}

interface ParsedSelector {
  name: string
  chain: readonly string[]
}

function parseSelector(selector: string): ParsedSelector {
  const parts = selector.split('/')
  return { name: parts[parts.length - 1] ?? '', chain: parts.slice(0, -1) }
}

const endsWith = (literals: readonly string[], chain: readonly string[]): boolean =>
  chain.length <= literals.length &&
  chain.every((token, i) => literals[literals.length - chain.length + i] === token)

/**
 * Everything a selector could name, with where it sits.
 *
 * Arguments and flags in one list because a rule addresses both the same way, even
 * though they read from different tables — `value.args` is keyed by the argument's own
 * path and `value.flags` by `<flagset path>/<flag name>`, which is the key the
 * renderer and the serializer already write.
 */
function located(root: Node, instances: RepeatInstances | typeof STATIC): Located[] {
  const found: Located[] = []
  walk(root, ROOT, instances, (node, path, literals) => {
    if (node.kind === 'argument') {
      found.push({ kind: 'argument', name: node.name, type: node.type, literals, path })
    } else if (node.kind === 'flagset') {
      for (const flag of node.flags) {
        found.push({ kind: 'flag', name: flag.name, literals, path: `${path}/${flag.name}` })
      }
    }
  })
  return found
}

/** Every argument and flag in the definition, each counted once however often it repeats. */
export function staticLocations(root: Node): StaticLocation[] {
  return located(root, STATIC).map(({ kind, name, type, literals }) => ({
    kind,
    name,
    type,
    literals,
  }))
}

/**
 * The nodes a selector names. More than one is the failure invariant 7 catches.
 *
 * Resolved against the definition alone — no repeat counts — because what a name means
 * cannot depend on how many clauses the user has added.
 */
export function resolveTarget(root: Node, selector: string): StaticLocation[] {
  const { name, chain } = parseSelector(selector)
  return staticLocations(root).filter((l) => l.name === name && endsWith(l.literals, chain))
}

/** A live path, and which of the value tables it keys into. */
export interface TargetPath {
  kind: 'argument' | 'flag'
  path: Path
}

/**
 * Every path a selector's node occupies right now.
 *
 * This is where the two questions meet: resolve statically to one node, then expand
 * that node to however many instances of it currently exist. A selector that resolves
 * to several nodes still expands all of them rather than throwing — invariant 7 has
 * already reported it, and a broken definition should warn rather than take the output
 * panel down with it.
 *
 * The `kind` travels with the path because arguments and flags live in different
 * tables. Reading it off the selector's spelling instead is what the old global suffix
 * scan did, and it could not tell a typo from a flag that simply was not set.
 */
export function pathsForTarget(
  root: Node,
  selector: string,
  instances: RepeatInstances,
): TargetPath[] {
  const { name, chain } = parseSelector(selector)
  return located(root, instances)
    .filter((l) => l.name === name && endsWith(l.literals, chain))
    .map(({ kind, path }) => ({ kind, path }))
}

/**
 * The shortest selector that names this location and nothing else.
 *
 * Used by invariant 7's diagnostic, so an ambiguous target is reported with a working
 * replacement rather than only with a complaint. That is the difference between a
 * check people follow and one they route around. Returns the bare name when even the
 * full chain cannot disambiguate — `/loot` and `/teleport` — because a suggestion that
 * does not work is worse than none.
 */
export function qualify(root: Node, location: StaticLocation): string {
  for (let depth = 0; depth <= location.literals.length; depth++) {
    const tail = location.literals.slice(location.literals.length - depth)
    const selector = [...tail, location.name].join('/')
    if (resolveTarget(root, selector).length === 1) return selector
  }
  return location.name
}
