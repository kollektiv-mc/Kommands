import type { ArgumentOptions } from './types'

/**
 * An argument's authored default as display text, or undefined when there is none.
 *
 * Editors show it as the placeholder of an empty field: the value the game uses when
 * the argument is left out. Its own module rather than a helper in the argument-type
 * registry, because the registry imports every editor and an editor importing it back
 * would close a cycle.
 */
export function defaultText(options: ArgumentOptions): string | undefined {
  const value = options.default
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}
