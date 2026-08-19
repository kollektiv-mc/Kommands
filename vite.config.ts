/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  },
})
