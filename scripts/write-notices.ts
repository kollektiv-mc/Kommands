#!/usr/bin/env tsx
//
// Write the licence texts of everything bundled into a build to
// dist/third-party-licenses.txt.
//
// MIT and BSD both require their copyright and permission notice to travel with
// every copy, and a bundle or a binary is a copy. Written into dist/ after
// `vite build` rather than committed: dist/ is what the hosted site serves and what
// the Wails binary embeds, so the file reaches both builds, and a file generated on
// every build cannot drift from the lockfile the way a committed one could. NOTICE
// names this file; see there for what the MIT licence does not cover.
//
// The Go section is written only with --go, which `pnpm build:desktop` passes and
// wails.json's frontend:build runs. The hosted web build ships no Go code and must
// not depend on a Go toolchain being present on whatever machine deploys it.
//
// Run with: pnpm build or pnpm build:desktop (it runs last in both).

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface Notice {
  name: string
  version: string
  licence: string
  text: string | null
}

const LICENCE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i

/**
 * Licence texts for packages that declare a licence but ship no licence file, committed
 * under scripts/licences/ with the package name's "/" written as "__". Each is copied
 * from the package's own repository:
 *
 * - @react-three__fiber: github.com/pmndrs/react-three-fiber, LICENSE on master.
 */
export function committedLicence(name: string, dir = join('scripts', 'licences')): string | null {
  const file = join(dir, name.replace('/', '__'))
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null
}

export function licenceText(dir: string): string | null {
  if (!existsSync(dir)) return null
  const file = readdirSync(dir).find((entry) => LICENCE_FILE.test(entry))
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null
}

type Section<T> = { title: string; notices: T[] }
type Shippable = Notice & { text: string }

export function renderNotices(sections: Section<Shippable>[]): string {
  const rule = '='.repeat(78)
  const out = [
    'Third-party software in Kommands',
    '',
    'Kommands itself is under the MIT licence (LICENSE). What follows are the',
    'licences of the software each build bundles, as their licences require.',
    'NOTICE, in the source repository, lists what the MIT licence does not cover.',
  ]
  for (const section of sections) {
    if (section.notices.length === 0) continue
    out.push('', rule, section.title, rule)
    for (const notice of [...section.notices].sort((a, b) => a.name.localeCompare(b.name))) {
      out.push('', `${notice.name} ${notice.version} (${notice.licence})`, '-'.repeat(78))
      out.push(notice.text)
    }
  }
  return out.join('\n') + '\n'
}

interface PnpmLicenceEntry {
  name: string
  versions: string[]
  paths: string[]
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    // pnpm is a .cmd shim on Windows, which execFile cannot start without a shell. Go
    // is a real executable and must not get one: a shell would re-split the go list
    // template on its spaces.
    shell: process.platform === 'win32' && command === 'pnpm',
    maxBuffer: 64 << 20,
  })
}

function npmNotices(): Notice[] {
  const byLicence = JSON.parse(run('pnpm', ['licenses', 'list', '--prod', '--json'])) as Record<
    string,
    PnpmLicenceEntry[]
  >
  return Object.entries(byLicence).flatMap(([licence, packages]) =>
    packages.map((pkg) => ({
      name: pkg.name,
      version: pkg.versions.join(', '),
      licence,
      text: (pkg.paths[0] ? licenceText(pkg.paths[0]) : null) ?? committedLicence(pkg.name),
    })),
  )
}

function goNotices(): Notice[] {
  // -deps over the main package is what the linker sees, so a module the shell
  // requires but never imports is correctly left out. -e tolerates an embed pattern
  // that has nothing to match in a checkout that has not built dist/ yet.
  const listed = run('go', [
    'list',
    '-deps',
    '-e',
    '-f',
    '{{with .Module}}{{if not .Main}}{{.Path}}\t{{.Version}}\t{{.Dir}}{{end}}{{end}}',
    '.',
  ])
  const modules = new Map<string, Notice>()
  for (const line of listed.split('\n')) {
    const [path, version, dir] = line.split('\t')
    if (!path || !version || modules.has(path)) continue
    modules.set(path, { name: path, version, licence: 'see text', text: licenceText(dir ?? '') })
  }
  const goroot = run('go', ['env', 'GOROOT']).trim()
  const goVersion = run('go', ['env', 'GOVERSION']).trim()
  modules.set('Go standard library', {
    name: 'Go standard library',
    version: goVersion,
    licence: 'BSD-3-Clause',
    text: licenceText(goroot),
  })
  return [...modules.values()]
}

function main(): void {
  if (!existsSync('dist')) {
    console.error('write-notices: dist/ does not exist; run vite build first.')
    process.exit(1)
  }
  const sections = [{ title: 'Bundled into the interface (npm)', notices: npmNotices() }]
  if (process.argv.includes('--go')) {
    sections.push({ title: 'Linked into the desktop shell (Go)', notices: goNotices() })
  }
  // Fails the build rather than warning: a bundled package whose notice cannot be
  // shipped is a licence breach in every copy, and a warning in a build log is read
  // by nobody. Add its text under scripts/licences/ and list it above.
  const missing = sections.flatMap((s) => s.notices).filter((n) => n.text === null)
  for (const notice of missing) {
    console.error(`write-notices: no licence text for ${notice.name} ${notice.version}`)
  }
  if (missing.length > 0) process.exit(1)
  const shippable = sections.map((section) => ({
    title: section.title,
    notices: section.notices.filter((n): n is Shippable => n.text !== null),
  }))
  writeFileSync(join('dist', 'third-party-licenses.txt'), renderNotices(shippable))
}

// Run as a script, not when a test imports it for its functions.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
