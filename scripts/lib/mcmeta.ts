import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Fetch a file from a pinned misode/mcmeta summary tag, through a local cache.
 *
 * Pinned by tag, never by branch: a branch reference would make the generated output
 * depend on when the build ran, and "regeneration is deterministic" is the property
 * the committed data rests on.
 *
 * Because the tag is immutable, so is the cache — a warm run never touches the
 * network, which is what keeps `pnpm gen:commands` (and the clean-diff check that
 * runs it) from turning an mcmeta outage into a red build on an unrelated change.
 */

const CACHE_ROOT = '.cache/mcmeta'
/** The three files each summary tag publishes. */
export type SummaryFile = 'commands' | 'registries' | 'blocks'

const RETRIES = 4

export async function fetchSummary(tag: string, file: SummaryFile): Promise<unknown> {
  const cached = join(CACHE_ROOT, tag, `${file}.json`)
  if (existsSync(cached)) {
    return JSON.parse(readFileSync(cached, 'utf8'))
  }

  const url = `https://raw.githubusercontent.com/misode/mcmeta/${tag}/${file}/data.json`
  const body = await getWithRetry(url)

  mkdirSync(dirname(cached), { recursive: true })
  writeFileSync(cached, body)
  return JSON.parse(body)
}

async function getWithRetry(url: string): Promise<string> {
  let lastError = ''
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) {
      // 1s, 2s, 4s. A transient 5xx or a dropped connection should not fail a build
      // whose input is a file that has not changed since the tag was cut.
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
    }
    try {
      const response = await fetch(url)
      if (response.ok) return await response.text()
      // A 404 means the tag or path is wrong, which no amount of retrying fixes.
      if (response.status === 404) {
        throw new Error(`${url} returned 404 — is the tag right?`)
      }
      lastError = `HTTP ${response.status}`
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) throw error
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(`could not fetch ${url} after ${RETRIES} attempts: ${lastError}`)
}

/**
 * The provenance block every generated file carries in place of a comment.
 *
 * `source` names where the data came from, and defaults to the mcmeta tag because
 * that is where all of it came from originally. A generator that derives from
 * *already-derived* output passes its own — `gen-fingerprints.ts` reads the committed
 * catalogue rather than mcmeta, and a header claiming otherwise would send someone
 * looking upstream for a value this repo produced.
 */
export function generatedHeader(
  tag: string,
  generator: string,
  regenerate: string,
  source = `misode/mcmeta@${tag}`,
) {
  return {
    doNotEdit:
      'GENERATED FILE — DO NOT EDIT. Hand edits are reverted by the next run, and the ' +
      'underlying issue survives. If a value here is wrong, the generator is wrong.',
    generator,
    source,
    regenerate,
  }
}

/**
 * Serialise for a reviewable diff.
 *
 * Pretty-printed with sorted keys, deliberately. The entire reason generated data is
 * committed is that a version bump shows up as a readable diff — the 1.21.2 attribute
 * rename appearing in a pull request rather than silently changing behaviour. Compact
 * JSON would be one 500 KB line and would give that up while looking like a saving.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n'
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  // `$generated` first so the warning is the first thing in the file, then the rest
  // alphabetically so a diff never reorders.
  for (const key of Object.keys(source).sort(byHeaderThenName)) {
    out[key] = sortKeys(source[key])
  }
  return out
}

function byHeaderThenName(a: string, b: string): number {
  if (a === '$generated') return -1
  if (b === '$generated') return 1
  return a < b ? -1 : a > b ? 1 : 0
}
