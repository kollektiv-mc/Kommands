/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// The release line the download page shows (`0.1.0 snapshot`), from the one place the
// version is defined. version.go holds `0.1.0-dev` between releases; the page shows the
// version without that suffix, which is what the snapshot and the next release share.
const goVersion = /^var Version = "([^"]+)"/m.exec(readFileSync('version.go', 'utf8'))?.[1]
if (goVersion === undefined) throw new Error('vite.config.ts: no Version in version.go')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(goVersion.replace(/-.*$/, '')),
  },
  build: {
    // The generated data chunks are large and deliberately lazy, so Vite's generic
    // 500 KB warning fires on every build and is wrong every time. scripts/check-bundle.ts
    // replaces it with a budget on the entry chunk, which is the number that matters.
    chunkSizeWarningLimit: Infinity,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    // `pnpm test:coverage`. Source only: src/data/generated and src/styles are
    // generated, main.tsx is the mount call, test-setup.ts is the harness, and a
    // test file measures nothing. The v8 provider instruments nothing at build
    // time, so `pnpm test` stays exactly as fast as it was.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/data/generated/**',
        'src/styles/**',
        'src/main.tsx',
        'src/test-setup.ts',
        'src/**/*.d.ts',
      ],
      reporter: ['text-summary'],
      // The floor, held the way scripts/coverage-floor holds the Go one: a few
      // points under the first measurement, raised as coverage rises, never
      // lowered to make a build pass. Lines only, the one number the Go floor
      // also uses, so the two read the same way. Measured 2026-09-11 on 770
      // tests: 89.1% of lines.
      thresholds: { lines: 86 },
    },
  },
})
