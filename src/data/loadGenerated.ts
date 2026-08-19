import type { CommandDefinition } from '../schema/types'
import { makeRegistryLookup } from './versions/registry'
import type { RegistryLookup, VersionDefinition } from './versions/types'

/**
 * Loading generated data.
 *
 * Deliberately *beside* src/data/generated rather than inside it. That directory is
 * declared in .claude/suite.json as one that must be unchanged after `pnpm
 * gen:commands`, and .claude/rules/generated-data.md scopes its never-edit rule to the
 * same path — so a hand-written file in there would fail the clean-diff check the
 * moment anyone touched it, while telling its author not to.
 *
 * Everything here is loaded on demand rather than bundled: 1.21.1 alone is ~550 KB of
 * command skeletons, ~660 KB of registries and ~260 KB of block states, and putting
 * any of it in the entry chunk would trade a fast first paint for data most sessions
 * never touch.
 *
 * The JSON files carry a `$generated` header instead of the DO-NOT-EDIT comment a
 * .ts file would have, because JSON has no comments. `readPayload` checks it, so a
 * file that has been hand-edited into a different shape, or a version mismatch
 * between a definition and its data, fails loudly here rather than as a confusing
 * undefined three layers up.
 */

function readPayload<T>(raw: unknown, key: string, version: string, file: string): T {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`${file}: not an object. Run \`pnpm gen:commands\`.`)
  }
  const payload = raw as Record<string, unknown>
  if (typeof payload.$generated !== 'object' || payload.$generated === null) {
    throw new Error(
      `${file}: no $generated header. Either it was hand-edited — which the next ` +
        `\`pnpm gen:commands\` reverts anyway — or it predates the header.`,
    )
  }
  if (payload.version !== version) {
    throw new Error(
      `${file}: holds data for ${String(payload.version)}, loaded as ${version}. ` +
        `A definition and its generated data have drifted apart.`,
    )
  }
  const data = payload[key]
  if (typeof data !== 'object' || data === null) throw new Error(`${file}: no "${key}" key`)
  return data as T
}

// One dynamic import per file per version. Vite code-splits each into its own chunk,
// and the browser caches them independently — a session that never opens a
// block-argument editor never downloads blocks.json.
const LOADERS = {
  '1.21.1': {
    commands: () => import('./generated/1.21.1/commands.json'),
    registries: () => import('./generated/1.21.1/registries.json'),
    blocks: () => import('./generated/1.21.1/blocks.json'),
  },
} as const satisfies Record<string, Record<string, () => Promise<unknown>>>

export type GeneratedVersionId = keyof typeof LOADERS

export function hasGeneratedData(id: string): id is GeneratedVersionId {
  return id in LOADERS
}

function loadersFor(version: VersionDefinition) {
  if (!hasGeneratedData(version.id)) {
    throw new Error(
      `no generated data for ${version.id}. Add it to src/data/versions, then run ` +
        `\`pnpm gen:commands\` — see docs/adding-a-version.md.`,
    )
  }
  return LOADERS[version.id]
}

const commandCache = new Map<string, Promise<Record<string, CommandDefinition>>>()

export function loadCommands(
  version: VersionDefinition,
): Promise<Record<string, CommandDefinition>> {
  const cached = commandCache.get(version.id)
  if (cached) return cached
  const promise = loadersFor(version)
    .commands()
    .then((m) =>
      readPayload<Record<string, CommandDefinition>>(
        m.default,
        'commands',
        version.id,
        `${version.id}/commands.json`,
      ),
    )
  commandCache.set(version.id, promise)
  return promise
}

const registryCache = new Map<string, Promise<RegistryLookup>>()

export function loadRegistries(version: VersionDefinition): Promise<RegistryLookup> {
  const cached = registryCache.get(version.id)
  if (cached) return cached
  const promise = loadersFor(version)
    .registries()
    .then((m) => {
      const registries = readPayload<Record<string, string[]>>(
        m.default,
        'registries',
        version.id,
        `${version.id}/registries.json`,
      )
      return makeRegistryLookup(registries)
    })
  registryCache.set(version.id, promise)
  return promise
}

export function loadBlocks(version: VersionDefinition): Promise<Record<string, unknown>> {
  return loadersFor(version)
    .blocks()
    .then((m) =>
      readPayload<Record<string, unknown>>(
        m.default,
        'blocks',
        version.id,
        `${version.id}/blocks.json`,
      ),
    )
}
