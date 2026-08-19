/**
 * Compare two versions' registries, with removals as the headline.
 *
 * Additions are harmless: a command that was valid stays valid. **Removals and
 * renames are not** — they turn a command that worked into one that silently does
 * nothing, and they are invisible in a syntax diff because the syntax did not change.
 * The 1.21.2 attribute rename is the case in point: 31 removed, 32 added, no trait
 * involved.
 */

export interface RegistryChange {
  registry: string
  added: string[]
  removed: string[]
  /** Ids whose only change is a category prefix — `generic.armor` -> `armor`. */
  reprefixed: { from: string; to: string }[]
}

const stripPrefix = (id: string) => (id.includes('.') ? id.slice(id.indexOf('.') + 1) : id)

export function diffRegistries(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): RegistryChange[] {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()

  return names
    .map((registry) => {
      const from = new Set(before[registry] ?? [])
      const to = new Set(after[registry] ?? [])

      const added = [...to].filter((id) => !from.has(id)).sort()
      const removed = [...from].filter((id) => !to.has(id)).sort()

      // A rename that only drops a category prefix reads as a total wipe otherwise —
      // 31 removed, 32 added — which buries the one genuinely new entry among 31
      // false alarms. Reporting it as a re-prefixing is what makes the real change
      // (`tempt_range`) visible.
      const reprefixed = removed
        .map((id) => ({ from: id, to: stripPrefix(id) }))
        .filter((pair) => pair.from !== pair.to && to.has(pair.to))

      return { registry, added, removed, reprefixed }
    })
    .filter((c) => c.added.length > 0 || c.removed.length > 0)
}

export function formatDiff(changes: RegistryChange[], before: string, after: string): string {
  if (changes.length === 0) return `No registry changes between ${before} and ${after}.`

  const lines = [`Registry changes, ${before} -> ${after}`, '']
  for (const c of changes) {
    const reprefixed = new Set(c.reprefixed.map((p) => p.from))
    const realRemovals = c.removed.filter((id) => !reprefixed.has(id))
    const realAdditions = c.added.filter((id) => !c.reprefixed.some((p) => p.to === id))

    lines.push(
      `${c.registry}: +${c.added.length} -${c.removed.length}` +
        (c.reprefixed.length > 0 ? ` (${c.reprefixed.length} re-prefixed)` : ''),
    )
    if (realRemovals.length > 0) {
      lines.push(`  REMOVED — commands using these become invalid:`)
      for (const id of realRemovals) lines.push(`    - ${id}`)
    }
    if (c.reprefixed.length > 0) {
      const sample = c.reprefixed.slice(0, 3).map((p) => `${p.from} -> ${p.to}`)
      lines.push(
        `  re-prefixed: ${sample.join(', ')}` +
          (c.reprefixed.length > 3 ? `, and ${c.reprefixed.length - 3} more` : ''),
      )
    }
    if (realAdditions.length > 0) {
      lines.push(
        `  added: ${realAdditions.slice(0, 6).join(', ')}` +
          (realAdditions.length > 6 ? `, and ${realAdditions.length - 6} more` : ''),
      )
    }
    lines.push('')
  }

  const removalCount = changes.reduce(
    (n, c) => n + c.removed.filter((id) => !c.reprefixed.some((p) => p.from === id)).length,
    0,
  )
  lines.push(
    removalCount === 0
      ? 'No outright removals. Additions alone cannot invalidate an existing command.'
      : `${removalCount} outright removal(s). Each one invalidates any command that names it.`,
  )
  return lines.join('\n')
}
