import { expect, test } from 'vitest'
import type { VersionDefinition, VersionTraits } from './types'
import { v1_21_1 } from './1.21.1'
import { DEFAULT_VERSION_ID, findVersion, VERSIONS } from './index'

// ── Compile-time assertions ─────────────────────────────────────────────────
// These are checked by `pnpm typecheck`, not at runtime. @ts-expect-error inverts
// the assertion: if the annotated line ever stops being an error, the directive
// itself becomes one and tsc fails. So "a missing trait is a type error" is
// enforced by the compiler rather than by anyone remembering the rule.
//
// Placement matters and is not uniform: a *missing* property is reported on the
// declaration, while a bad value or an excess property is reported on the property
// itself. Each directive below sits directly above whichever line tsc blames.

// @ts-expect-error — omitting a trait must not compile. No inheritance, no defaults.
const _missingTrait: VersionTraits = {
  itemFormat: 'components',
  enchantmentsShape: 'levels-wrapper',
}

const _badValue: VersionTraits = {
  itemFormat: 'components',
  enchantmentsShape: 'levels-wrapper',
  // @ts-expect-error — a value outside the union must not compile.
  textComponentFormat: 'nbt',
}

const _revivedTrait: VersionTraits = {
  itemFormat: 'components',
  enchantmentsShape: 'levels-wrapper',
  textComponentFormat: 'json-string',
  // @ts-expect-error — the dropped attribute trait must not come back by accident.
  attributeIdPrefix: 'generic.',
}

void _missingTrait
void _badValue
void _revivedTrait

// ── Runtime ─────────────────────────────────────────────────────────────────

test('1.21.1 sits between the two breaking changes', () => {
  // Getting either of these backwards is the failure mode this version is prone to:
  // pre-1.20.5 NBT on one side, post-1.21.5 flattening on the other.
  expect(v1_21_1.traits).toEqual({
    itemFormat: 'components',
    enchantmentsShape: 'levels-wrapper',
    textComponentFormat: 'json-string',
  })
})

test('every version pins an mcmeta tag rather than a branch', () => {
  for (const version of VERSIONS) {
    expect(version.mcmetaTag).toMatch(/-summary$/)
    expect(version.mcmetaTag.startsWith(version.id)).toBe(true)
  }
})

test('findVersion resolves the default and misses cleanly', () => {
  const found: VersionDefinition | undefined = findVersion(DEFAULT_VERSION_ID)
  expect(found).toBe(v1_21_1)
  expect(findVersion('0.0.0')).toBeUndefined()
})
