import type { ArgumentOptions, Diagnostic } from './types'
import type { SerializeContext } from '../data/versions/types'

/** The vanilla namespace, which the game assumes for an id written without one. */
const DEFAULT_NAMESPACE = 'minecraft:'

const bare = (id: string) =>
  id.startsWith(DEFAULT_NAMESPACE) ? id.slice(DEFAULT_NAMESPACE.length) : id

/**
 * The registry an argument's ids come from, as `RegistryLookup` keys it.
 *
 * The skeleton names it the way the game does, namespaced, and the registries are
 * keyed without the namespace (`mob_effect`), so a lookup by the
 * skeleton's name found nothing and every such field was a bare text box.
 */
export function registryOf(options: ArgumentOptions): string | undefined {
  return typeof options.registry === 'string' ? bare(options.registry) : undefined
}

/**
 * Whether an id is in its registry, when the argument names one. Warns, never blocks:
 * a datapack can add entries no vanilla registry lists. A `#tag` is not checked.
 */
export function validateResource(
  value: string,
  options: ArgumentOptions,
  ctx: SerializeContext,
): Diagnostic[] {
  const registry = registryOf(options)
  const id = value.trim()
  if (registry === undefined || id === '' || id.startsWith('#')) return []
  if (ctx.registries.entries(registry).length === 0) return []
  if (id.includes(':') && !id.startsWith(DEFAULT_NAMESPACE)) return []
  if (ctx.registries.has(registry, bare(id))) return []
  return [
    { severity: 'warning', message: `Not a known ${registry.replace(/_/g, ' ')} in this version` },
  ]
}
