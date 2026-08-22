#!/usr/bin/env tsx
//
// Guard against silent entry-chunk regressions.
//
// The budget covers the **entry chunk only** — the bytes every page load pays for.
// The generated-data chunks are excluded on purpose: commands.json, registries.json
// and blocks.json are dynamically imported, and the whole point of splitting them out
// is that a session pays for them only when it opens something that needs them. A
// budget that counted them would punish exactly the arrangement it should protect.
//
// This replaces Vite's built-in chunk-size warning, which fires on registries.json's
// 537 KB chunk on every build. That warning is a false positive here — the chunk is
// already lazy — and a warning that is always wrong is a warning nobody reads.
//
// Run with: pnpm check-bundle

import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

// Measured after the generated data was split out: 92.4 KB. Budget is that plus
// headroom, rounded. Three.js and the preview modules must stay lazy (#12) or this
// is the check that says so.
const ENTRY_BUDGET_KB = 120

// A budget alone would not catch this. Three.js is ~150 KB gzip, so an eager import
// would blow the budget today — but the budget is a number someone can raise, and the
// entry chunk staying free of the renderer is a structural claim rather than a size
// one. docs/health-checklist.md § 3 states it; this is what enforces it.
//
// Matched on identifiers three's own source defines, not on the package name: a bare
// "three" appears in ordinary English and in minified variable names, while these are
// what the library actually ships.
const THREE_FINGERPRINTS = ['WebGLRenderer', 'BufferGeometry', 'InstancedMesh']

const distAssets = join('dist', 'assets')

let files: string[]
try {
  files = (await readdir(distAssets)).filter((f) => f.endsWith('.js'))
} catch {
  console.error(`check-bundle: no ${distAssets}. Run \`pnpm build\` first.`)
  process.exit(1)
}

const rows = await Promise.all(
  files.map(async (file) => {
    const source = await readFile(join(distAssets, file))
    return {
      file,
      gzipKB: gzipSync(source).length / 1024,
      source: source.toString('utf8'),
    }
  }),
)
rows.sort((a, b) => b.gzipKB - a.gzipKB)

console.log('Bundle sizes (gzip):')
const entryPattern = /^index-.*\.js$/
for (const { file, gzipKB } of rows) {
  // Everything that is not the entry chunk is, by construction, reached through a
  // dynamic import — Vite emits a separate chunk for nothing else. Listing them by an
  // allowlist of names meant adding a name every time something new was split out, and
  // a preview chunk carries the module's filename rather than a name chosen here.
  const lazy = entryPattern.test(file) ? '' : '  (lazy)'
  console.log(`  ${gzipKB.toFixed(1).padStart(8)} KB  ${file}${lazy}`)
}

const entry = rows.find((r) => entryPattern.test(r.file))
if (!entry) {
  console.error('check-bundle: no index-*.js entry chunk in dist/assets')
  process.exit(1)
}

const leaked = THREE_FINGERPRINTS.filter((name) => entry.source.includes(name))
if (leaked.length > 0) {
  console.error(`\n\u2716 Three.js is in the entry chunk (found ${leaked.join(', ')}).`)
  console.error('  A preview module or the shared stage is being imported statically.')
  console.error('  Both must be reached only through a dynamic import — see')
  console.error('  .claude/rules/previews.md and docs/adding-a-preview.md.')
  process.exit(1)
}
console.log('\u2713 Three.js is not in the entry chunk.')

console.log(
  `\nEntry chunk (${entry.file}): ${entry.gzipKB.toFixed(1)} KB gzip ` +
    `(budget: ${ENTRY_BUDGET_KB} KB)`,
)

if (entry.gzipKB > ENTRY_BUDGET_KB) {
  const over = (entry.gzipKB - ENTRY_BUDGET_KB).toFixed(1)
  console.error(`\n✖ Entry chunk is ${over} KB over the ${ENTRY_BUDGET_KB} KB gzip budget.`)
  console.error('  Usually a new eager import that should be dynamic — check what moved into')
  console.error('  the entry chunk before raising ENTRY_BUDGET_KB in scripts/check-bundle.ts.')
  process.exit(1)
}

console.log('✓ Entry chunk within budget.')
