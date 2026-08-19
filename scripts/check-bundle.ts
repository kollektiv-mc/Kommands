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

const distAssets = join('dist', 'assets')

let files: string[]
try {
  files = (await readdir(distAssets)).filter((f) => f.endsWith('.js'))
} catch {
  console.error(`check-bundle: no ${distAssets}. Run \`pnpm build\` first.`)
  process.exit(1)
}

const rows = await Promise.all(
  files.map(async (file) => ({
    file,
    gzipKB: gzipSync(await readFile(join(distAssets, file))).length / 1024,
  })),
)
rows.sort((a, b) => b.gzipKB - a.gzipKB)

console.log('Bundle sizes (gzip):')
for (const { file, gzipKB } of rows) {
  const lazy = /^(commands|registries|blocks)-/.test(file) ? '  (lazy)' : ''
  console.log(`  ${gzipKB.toFixed(1).padStart(8)} KB  ${file}${lazy}`)
}

const entry = rows.find((r) => /^index-.*\.js$/.test(r.file))
if (!entry) {
  console.error('check-bundle: no index-*.js entry chunk in dist/assets')
  process.exit(1)
}

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
