import type { VersionDefinition } from './types'
import { v1_21_1 } from './1.21.1'

export type { VersionDefinition, VersionTraits, SerializeContext, RegistryLookup } from './types'

/** Every version this build can target. Adding one is a data change. */
export const VERSIONS: readonly VersionDefinition[] = [v1_21_1]

export const DEFAULT_VERSION_ID = v1_21_1.id

export function findVersion(id: string): VersionDefinition | undefined {
  return VERSIONS.find((v) => v.id === id)
}
