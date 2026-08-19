#!/usr/bin/env tsx
//
// Compare two versions' registries. The step that catches silent breakage when a
// Minecraft version is added — see docs/adding-a-version.md § 4.
//
//   pnpm gen:diff 1.21.1 1.21.5
//   pnpm gen:diff 1.21.1-summary 1.21.5-summary
//
// Accepts either a version this repo supports or a raw mcmeta tag, so a version can
// be inspected before it is adopted — which is the point: you want to know what
// changed before deciding to support it.

import { fetchSummary } from './lib/mcmeta'
import { diffRegistries, formatDiff } from './lib/registry-diff'
import { findVersion } from '../src/data/versions/index'

const [before, after] = process.argv.slice(2)
if (!before || !after) {
  console.error('usage: pnpm gen:diff <before> <after>   (version id or mcmeta tag)')
  process.exit(2)
}

const asTag = (arg: string) => findVersion(arg)?.mcmetaTag ?? arg

const [beforeTag, afterTag] = [asTag(before), asTag(after)]
const [a, b] = (await Promise.all([
  fetchSummary(beforeTag, 'registries'),
  fetchSummary(afterTag, 'registries'),
])) as [Record<string, string[]>, Record<string, string[]>]

console.log(formatDiff(diffRegistries(a, b), beforeTag, afterTag))
