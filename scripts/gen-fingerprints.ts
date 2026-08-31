#!/usr/bin/env tsx
//
// Record the structural fingerprint of every command definition, per version.
//
//   src/data/generated/<version>/commands.json  ->  .../fingerprints.json
//   src/data/authored/commands/**
//
// Output is committed, and that is the whole point. A saved command stores raw paths
// into a definition's node arrays, and those arrays are regenerated from mcmeta — so a
// deriver change or an edited authored definition can silently repoint every value a
// user saved. docs/persistence.md § How values are keyed calls the fingerprint a
// tripwire; until this file existed the tripwire was only armed at *save* time, and
// checking whether one had moved between releases was a manual ritual nobody performs.
//
// Committing the index makes the move a line in a pull-request diff, enforced by the
// `generated` clean-diff check in .claude/suite.json the same way commands.json is.
// It also lets the dashboard tell a stale tree from a live one without loading the
// 560 KB of skeletons a saved command caches its `preview` to avoid.
//
// Reads only committed data, so it needs no network and has no legitimate skip.
//
// Run with: pnpm gen:fingerprints

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generatedHeader, stableJson } from './lib/mcmeta'
import { loadCatalogue } from '../src/data/catalogue'
import { fingerprintOf } from '../src/schema/fingerprint'
import { hasGeneratedData } from '../src/data/loadGenerated'
import { VERSIONS } from '../src/data/versions/index'

const GENERATOR = 'scripts/gen-fingerprints.ts'
const REGENERATE = 'pnpm gen:fingerprints'
const OUT_ROOT = 'src/data/generated'

async function fingerprintVersion(version: (typeof VERSIONS)[number]) {
  const { id, mcmetaTag } = version

  // Through loadCatalogue rather than by reading commands.json directly: the app runs
  // against derived definitions *merged with* authored ones and their presentation
  // metadata, and an index built from a different merge would be an index of a
  // catalogue nobody uses. fingerprints.test.ts asserts the two agree, so this is
  // checked rather than assumed — but sharing the function is what makes it true.
  const catalogue = await loadCatalogue(version)

  const fingerprints: Record<string, string> = {}
  for (const [definitionId, definition] of Object.entries(catalogue)) {
    fingerprints[definitionId] = fingerprintOf(definition)
  }

  const outDir = join(OUT_ROOT, id)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    join(outDir, 'fingerprints.json'),
    stableJson({
      $generated: generatedHeader(
        mcmetaTag,
        GENERATOR,
        REGENERATE,
        `${OUT_ROOT}/${id}/commands.json + src/data/authored/commands`,
      ),
      version: id,
      fingerprints,
    }),
  )
  return Object.keys(fingerprints).length
}

for (const version of VERSIONS) {
  // A version with no generated data has no commands.json to merge, so loadCatalogue
  // would throw. Skipping is right rather than fatal: docs/adding-a-version.md has
  // `pnpm gen:commands` come first, and a half-added version should not make this
  // generator the thing that reports it.
  if (!hasGeneratedData(version.id)) {
    console.warn(
      `gen-fingerprints: ${version.id} has no generated data yet — run \`pnpm gen:commands\` first`,
    )
    continue
  }
  const count = await fingerprintVersion(version)
  console.log(`gen-fingerprints: ${version.id} — ${count} definitions`)
}
