import type { ReactNode } from 'react'

interface AppShellProps {
  /** Route content. The shell owns the frame; routes own everything inside it. */
  children: ReactNode
}

/**
 * The application frame: a hairline-bordered header over a scrolling content well.
 *
 * This component is deliberately styled with nothing but semantic utilities backed
 * by the generated token layer — no literal hex, no arbitrary pixel value, no inline
 * style. docs/design-tokens.md names that as the goal of the token pipeline, and
 * .claude/suite.json's `no literal hex or px in components` invariant greps this
 * directory for violations.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-canvas text-text-primary flex h-full flex-col">
      <header className="border-b-hairline border-border-subtle bg-surface flex items-center gap-3 px-3 py-2">
        <span className="font-display text-sm tracking-tight">Kommands</span>
        <span className="text-text-muted text-2xs font-mono">Java Edition 1.21.1</span>
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-3">{children}</main>
    </div>
  )
}
