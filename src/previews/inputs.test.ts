import { describe, expect, test } from 'vitest'
import { loadCatalogue } from '../data/catalogue'
import { v1_21_1 } from '../data/versions/1.21.1'
import { EMPTY_VALUE, type CommandValue } from '../schema/serialize'
import { previewInputsKey, readPreviewInputs } from './inputs'

/**
 * What a module is handed, and when it is handed something new.
 *
 * Two claims live here, and the second is the one `docs/health-checklist.md` § 4 asks
 * for: a module sees **parsed values, never command text**, and it recomputes only when
 * a value it declared changes.
 */

const catalogue = await loadCatalogue(v1_21_1)
const generate = catalogue['worldedit:generate']!
const binding = generate.preview!

/** `//generate` is `//generate <flags> <pattern> <expression>` — paths /1, /2, /3. */
const withValues = (
  args: Record<string, unknown>,
  flags: Record<string, boolean> = {},
): CommandValue => ({
  ...EMPTY_VALUE,
  args: { ...EMPTY_VALUE.args, ...args },
  flags: { ...EMPTY_VALUE.flags, ...flags },
})

describe('a module receives parsed values, keyed by the selector that named them', () => {
  test('every declared input appears, and nothing else does', () => {
    const values = readPreviewInputs(generate, binding, EMPTY_VALUE)
    expect(Object.keys(values).sort()).toEqual(['-c', '-h', '-o', '-r', 'expression', 'pattern'])
  })

  test('an argument arrives as the value the editor stored, not as text', () => {
    const value = withValues({ '/3': 'x^2+y^2+z^2 < 1' })
    expect(readPreviewInputs(generate, binding, value)['expression']).toBe('x^2+y^2+z^2 < 1')
  })

  test('an unset flag is false rather than undefined, so a module need not guess', () => {
    const values = readPreviewInputs(generate, binding, EMPTY_VALUE)
    expect(values['-h']).toBe(false)
    expect(values['-r']).toBe(false)
  })

  test('a set flag is true', () => {
    const value = withValues({}, { '/1/-h': true })
    expect(readPreviewInputs(generate, binding, value)['-h']).toBe(true)
  })
})

describe('the memo key changes only for a declared input', () => {
  test('the same value tree gives the same key', () => {
    const value = withValues({ '/3': 'x < 0' })
    const key = previewInputsKey(readPreviewInputs(generate, binding, value))
    expect(previewInputsKey(readPreviewInputs(generate, binding, value))).toBe(key)
  })

  test('changing a declared input changes it', () => {
    const before = previewInputsKey(
      readPreviewInputs(generate, binding, withValues({ '/3': 'x < 0' })),
    )
    const after = previewInputsKey(
      readPreviewInputs(generate, binding, withValues({ '/3': 'x < 1' })),
    )
    expect(after).not.toBe(before)
  })

  test('setting a declared flag changes it', () => {
    const before = previewInputsKey(readPreviewInputs(generate, binding, EMPTY_VALUE))
    const after = previewInputsKey(
      readPreviewInputs(generate, binding, withValues({}, { '/1/-h': true })),
    )
    expect(after).not.toBe(before)
  })

  test('editing something the module never declared does not', () => {
    // The claim in one assertion. A binding that declared the whole value tree — or a
    // workbench that memoised on it — would recompute a 32,768-point evaluation because
    // someone typed in an unrelated field.
    const undeclared = { ...generate, preview: { ...binding, inputs: ['expression'] } }
    const before = previewInputsKey(
      readPreviewInputs(undeclared, undeclared.preview, withValues({ '/3': 'x < 0' })),
    )
    const after = previewInputsKey(
      readPreviewInputs(
        undeclared,
        undeclared.preview,
        withValues({ '/3': 'x < 0', '/2': { entries: [{ block: 'stone', weight: 1 }] } }),
      ),
    )
    expect(after).toBe(before)
  })
})
