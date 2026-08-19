#!/usr/bin/env tsx
//
// Derive vanilla command skeletons and registries from the Brigadier command tree
// published by misode/mcmeta, pinned by version-summary tag.
//
//   mcmeta <tag>  ->  src/data/generated/<version>/commands.json
//                 ->  src/data/generated/<version>/registries.json
//                 ->  src/data/generated/<version>/blocks.json
//
// Output is committed. Version bumps then produce reviewable diffs, builds work
// offline, and CI needs no network — see docs/architecture.md § Derivation.
//
// Run with: pnpm gen:commands

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchSummary, generatedHeader, stableJson } from './lib/mcmeta'
import { deriveCommands, type BrigadierNode } from './lib/derive'
import { VERSIONS } from '../src/data/versions/index'

const GENERATOR = 'scripts/derive-commands.ts'
const REGENERATE = 'pnpm gen:commands'
const OUT_ROOT = 'src/data/generated'

async function deriveVersion(version: (typeof VERSIONS)[number]) {
  const { id, mcmetaTag } = version
  const outDir = join(OUT_ROOT, id)
  mkdirSync(outDir, { recursive: true })
  const header = generatedHeader(mcmetaTag, GENERATOR, REGENERATE)

  const [commandTree, registries, blocks] = (await Promise.all([
    fetchSummary(mcmetaTag, 'commands'),
    fetchSummary(mcmetaTag, 'registries'),
    fetchSummary(mcmetaTag, 'blocks'),
  ])) as [BrigadierNode, Record<string, string[]>, Record<string, unknown>]

  const { definitions, gaps } = deriveCommands(commandTree, id)

  writeFileSync(
    join(outDir, 'commands.json'),
    stableJson({ $generated: header, version: id, commands: definitions }),
  )
  writeFileSync(
    join(outDir, 'registries.json'),
    stableJson({ $generated: header, version: id, registries }),
  )
  writeFileSync(
    join(outDir, 'blocks.json'),
    stableJson({ $generated: header, version: id, blocks }),
  )

  return { id, definitions, gaps, registries }
}

for (const version of VERSIONS) {
  const { id, definitions, gaps, registries } = await deriveVersion(version)

  const aliased = Object.values(definitions).flatMap((d) => d.aliases ?? [])
  console.log(
    `derive-commands: ${id} — ${Object.keys(definitions).length} commands, ` +
      `${aliased.length} aliases (${aliased.join(', ')}), ` +
      `${Object.keys(registries).length} registries`,
  )

  // Recorded, never swallowed. Each of these is an argument whose editor does not
  // exist yet, so it renders as a text field: the documented degradation, and the
  // list shrinks as #7 and #8 land.
  if (gaps.length > 0) {
    const byParser = new Map<string, number>()
    for (const gap of gaps) byParser.set(gap.parser, (byParser.get(gap.parser) ?? 0) + 1)
    const summary = [...byParser.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([parser, n]) => `${parser}×${n}`)
      .join(', ')
    console.log(`derive-commands: ${gaps.length} arguments on the raw_text fallback — ${summary}`)
  }
}
