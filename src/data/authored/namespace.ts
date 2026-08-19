/**
 * The namespace vanilla ids are written with.
 *
 * Its own module because more than the item catalogue needs it: a hover event names
 * an item and an entity type, and both are written as full resource locations while
 * the registries hold them bare.
 */
export const NAMESPACE = 'minecraft:'

/**
 * An id as a resource location.
 *
 * An id that already carries a namespace keeps it. Registries hold bare ids, so the
 * common case is prefixing — but a user may legitimately name something from a data
 * pack, and prefixing that produces an id with two namespaces and no meaning.
 */
export function namespaced(id: string): string {
  return id.includes(':') ? id : `${NAMESPACE}${id}`
}
