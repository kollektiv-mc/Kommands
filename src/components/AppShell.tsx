import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

interface AppShellProps {
  /** Route content. The shell owns the frame; routes own everything inside it. */
  children: ReactNode
}

/**
 * The application frame: a hairline-bordered header over a content well.
 *
 * The well no longer scrolls or pads. It did both when every route was one column of
 * content, and both became wrong once the editor arrived: that route is two panes
 * that scroll independently, and a scrolling ancestor would give it a second scrollbar
 * outside the pane the user is reading. Padding moved the same way — a full-height
 * two-pane layout wants its divider to reach the frame. Routes that do want a padded,
 * scrolling column now say so, which is one line each and honest about which layout
 * they are.
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
        {/*
          A link, not a label. The editor fills the viewport and the dashboard is the
          only way back to what has been saved, so the product name has to be the way
          there — it is where everyone reaches for it anyway.
        */}
        <Link to="/" className="font-display text-sm tracking-tight">
          Kommands
        </Link>
        <span className="text-text-muted text-2xs font-mono">Java Edition 1.21.1</span>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}
