/**
 * The version model: two independent axes, kept separate on purpose.
 *
 * Syntax traits answer *how* a value is written. Registry contents answer *which*
 * values exist. Conflating them produces wrong output — see docs/minecraft-versions.md.
 */

/**
 * How this version writes things.
 *
 * Every field is required. There is no inheritance, no defaults and no partials:
 * a version that omits a trait must fail `tsc`, not silently fall back to another
 * version's behaviour. The `@ts-expect-error` assertions in `versions.test.ts` hold
 * that line at typecheck time — easy to miss in a file named for runtime tests.
 *
 * These are flags, not an era enum, because the changes did not land together —
 * the enchantments restructure and the text-component move both landed at 1.21.5,
 * while the attribute rename landed at 1.21.2. No ordering of versions describes
 * that, which is why serializers branch on a trait and never on a version number.
 */
export interface VersionTraits {
  /** `nbt` before 1.20.5, `components` from it. */
  itemFormat: 'nbt' | 'components'
  /** The `levels` wrapper around enchantment entries; removed at 1.21.5. */
  enchantmentsShape: 'levels-wrapper' | 'flat'
  /** Text components are a quoted JSON string before 1.21.5, SNBT from it. */
  textComponentFormat: 'json-string' | 'snbt'
}

/**
 * Which values exist, for one version.
 *
 * Registries are pinned per version and never merged. Entries are removed as well as
 * added — every one of 1.21.1's 31 attribute IDs was replaced at 1.21.2 — so a shared
 * "latest" registry would offer values that do not exist in the target version.
 */
export interface RegistryLookup {
  /** Every entry in a registry, e.g. `has('item')`. Returns [] for an unknown one. */
  entries(registry: string): readonly string[]
  /** Whether an id exists in this version. Used by validators, which warn. */
  has(registry: string, id: string): boolean
}

export interface VersionDefinition {
  /** The Minecraft version, e.g. '1.21.1'. */
  id: string
  /** The mcmeta tag this version's data is derived from. Pinned; never a branch. */
  mcmetaTag: string
  traits: VersionTraits
}

/**
 * What a serializer is handed.
 *
 * It carries traits and registries and nothing else — in particular, not the version
 * id. A serializer that could read the version id would be one keystroke from
 * comparing it, and that comparison is the bug the whole trait model exists to
 * prevent.
 */
export interface SerializeContext {
  traits: VersionTraits
  registries: RegistryLookup
}
