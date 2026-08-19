import type { RegistryLookup } from './types'

/**
 * A `RegistryLookup` over a plain record of registry name → ids.
 *
 * One implementation, shared by the loader and by every test that needs a context.
 * The alternative was the shape it replaces: an inline `{ entries: () => [], has: ()
 * => true }` object literal, written out identically in three files, which is three
 * places for the `has` semantics below to be got wrong independently.
 */
export function makeRegistryLookup(
  registries: Readonly<Record<string, readonly string[]>>,
): RegistryLookup {
  return {
    entries: (registry) => (Object.hasOwn(registries, registry) ? registries[registry]! : []),
    // Unknown registry -> true, deliberately. A validator that warned "this item does
    // not exist" because *the registry* was missing would be blaming the user's input
    // for the app's gap, and validation only warns anyway.
    has: (registry, id) =>
      !Object.hasOwn(registries, registry) || registries[registry]!.includes(id),
  }
}

/**
 * A lookup that knows nothing.
 *
 * Every registry is empty and every id "exists", so a test can build a
 * SerializeContext without loading 660 KB of registries to assert a shape that does
 * not depend on them.
 */
export const NO_REGISTRIES: RegistryLookup = makeRegistryLookup({})
