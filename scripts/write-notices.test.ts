import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { committedLicence, licenceText, renderNotices } from './write-notices'

test('the licence file is found under the names packages actually use', () => {
  for (const name of ['LICENSE', 'LICENSE.md', 'licence.txt', 'COPYING', 'License']) {
    const dir = mkdtempSync(join(tmpdir(), 'notices-'))
    writeFileSync(join(dir, name), '  MIT text  \n')
    writeFileSync(join(dir, 'README.md'), 'not this')
    expect(licenceText(dir)).toBe('MIT text')
  }
})

test('a package without a licence file, or a missing directory, has no text', () => {
  const dir = mkdtempSync(join(tmpdir(), 'notices-'))
  writeFileSync(join(dir, 'LICENSE-THIRD-PARTY.json'), '{}')
  expect(licenceText(dir)).toBeNull()
  expect(licenceText(join(dir, 'absent'))).toBeNull()
})

test('packages are sorted within a section, and an empty section is dropped', () => {
  const text = renderNotices([
    {
      title: 'npm',
      notices: [
        { name: 'zeta', version: '1.0.0', licence: 'MIT', text: 'Z licence' },
        { name: 'alpha', version: '2.0.0', licence: 'Unlicense', text: 'A licence' },
      ],
    },
    { title: 'Go', notices: [] },
  ])
  expect(text.indexOf('alpha 2.0.0 (Unlicense)')).toBeLessThan(text.indexOf('zeta 1.0.0 (MIT)'))
  expect(text).toContain('A licence')
  expect(text).toContain('Z licence')
  expect(text).not.toContain('\nGo\n')
  expect(text.endsWith('\n')).toBe(true)
})

test('a committed licence text is found by package name, scope slash written as __', () => {
  const dir = mkdtempSync(join(tmpdir(), 'notices-'))
  writeFileSync(join(dir, '@scope__pkg'), 'Scoped licence\n')
  expect(committedLicence('@scope/pkg', dir)).toBe('Scoped licence')
  expect(committedLicence('absent', dir)).toBeNull()
})

test('the committed @react-three/fiber text is found from the repo root', () => {
  expect(committedLicence('@react-three/fiber')).toContain('Poimandres')
})
